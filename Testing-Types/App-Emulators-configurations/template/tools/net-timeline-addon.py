"""mitmdump addon: one JSON line per HTTP(S) request with WALL-CLOCK start/end, so a screen
recording can be paired with what the app asked for and how long it waited (net-compose.py).

  mitmdump -p 8080 -s net-timeline-addon.py --set netlog=<file.jsonl> [--set nethost=<api host>]

Each line: {"t0": ms, "t1": ms|null, "m": "GET", "u": url, "st": 200|null, "bytes": n|null,
            "err": null|"client closed"|"<error>", "d": {detail}}
`d` (connection phases, all wall-clock ms): ip = server address, reused = the TCP/TLS connection
existed before this request, tcp / tls = when the server connection was set up, sent = request
fully sent upstream, fb = first byte of the response (absent = the server never answered);
hdr = a few correlation headers of the response (server, date, request id, cf-ray, via);
with `--set netbodies=true` also q / r = the first 400 chars of the request / response body.
Authorization and cookies are never written. For everything else, add `-w <file>.mitm` to the
mitmdump command: that is the full dump (all headers and bodies), openable in `mitmweb -r <file>`.
`t1` with `err: "client closed"` is the tell-tale of a CLIENT-side timeout: the app gave up while
the server was still working — the case a request-less screen recording cannot show.
The app must actually route through this proxy (Flutter/Dart ignores the system proxy — see
EMULATOR_RULES, "Seeing the app's own requests"), and trust mitmproxy's CA or skip verification in
a QA-only build.
"""
import json, time
from mitmproxy import ctx, http


class NetTimeline:
    # a server connection seen on an earlier request = reused (keep-alive); mitmproxy opens the
    # upstream connection during the client's TLS handshake, i.e. BEFORE the request, so comparing
    # timestamps cannot tell "new" from "reused"
    def __init__(self):
        self._conns = set()

    def load(self, loader):
        loader.add_option("netlog", str, "net-timeline.jsonl", "where to append the JSON lines")
        loader.add_option("nethost", str, "", "only log requests to this host (substring); empty = all")
        loader.add_option("netbodies", bool, False, "also log the first 400 chars of request/response bodies")

    def _keep(self, flow):
        return not ctx.options.nethost or ctx.options.nethost in flow.request.pretty_host

    def _write(self, rec):
        with open(ctx.options.netlog, "a") as f:
            f.write(json.dumps(rec) + "\n")

    def _detail(self, flow):
        ms = lambda x: int(x * 1000) if x else None
        sc, rq, rs = flow.server_conn, flow.request, flow.response
        d = {"ip": sc.peername[0] if sc and sc.peername else None,
             "reused": bool(sc and sc.id in self._conns),
             "tcp": ms(sc and sc.timestamp_tcp_setup), "tls": ms(sc and sc.timestamp_tls_setup),
             "sent": ms(rq.timestamp_end), "fb": ms(rs and rs.timestamp_start)}
        if rs:
            keep = ("server", "date", "x-request-id", "x-amzn-requestid", "x-amzn-trace-id", "cf-ray", "via")
            d["hdr"] = {k: v for k, v in rs.headers.items() if k.lower() in keep}
        if ctx.options.netbodies:
            d["q"] = (rq.get_text(strict=False) or "")[:400]
            if rs:
                d["r"] = (rs.get_text(strict=False) or "")[:400]
        if sc: self._conns.add(sc.id)
        return d

    def response(self, flow: http.HTTPFlow):
        if not self._keep(flow):
            return
        r = flow.response
        self._write({"t0": int(flow.request.timestamp_start * 1000),
                     "t1": int((r.timestamp_end or time.time()) * 1000),
                     "m": flow.request.method, "u": flow.request.pretty_url,
                     "st": r.status_code, "bytes": len(r.raw_content or b""), "err": None,
                     "d": self._detail(flow)})

    def error(self, flow: http.HTTPFlow):
        if not self._keep(flow):
            return
        msg = str(flow.error.msg) if flow.error else "error"
        closed = "client disconnected" in msg.lower() or "client closed" in msg.lower()
        self._write({"t0": int(flow.request.timestamp_start * 1000), "t1": int(time.time() * 1000),
                     "m": flow.request.method, "u": flow.request.pretty_url, "st": None, "bytes": None,
                     "err": "client closed" if closed else msg[:80], "d": self._detail(flow)})


addons = [NetTimeline()]
