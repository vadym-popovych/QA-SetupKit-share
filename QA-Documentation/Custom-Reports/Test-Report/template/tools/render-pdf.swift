// Render every page of a PDF to PNG via CoreGraphics (macOS; no brew dependencies).
// Usage: swift render-pdf.swift <file.pdf> <out-prefix>   → <out-prefix>-pNN.png @2x
// Part of the verify-by-RENDER discipline (TEST_REPORT_RULES §7): an attribute diff cannot
// see pagination, headers or what a font actually looks like — this is what can.
import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

let args = CommandLine.arguments
guard args.count >= 3 else { FileHandle.standardError.write("usage: swift render-pdf.swift <file.pdf> <out-prefix>\n".data(using: .utf8)!); exit(2) }
let pdfPath = args[1], prefix = args[2]
let scale: CGFloat = 2.0
guard let doc = CGPDFDocument(URL(fileURLWithPath: pdfPath) as CFURL) else { fatalError("cannot open \(pdfPath)") }
for i in 1...doc.numberOfPages {
    guard let page = doc.page(at: i) else { continue }
    let box = page.getBoxRect(.mediaBox)
    let w = Int(box.width * scale), h = Int(box.height * scale)
    let cs = CGColorSpaceCreateDeviceRGB()
    guard let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0,
        space: cs, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { fatalError("no context") }
    ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
    ctx.fill(CGRect(x: 0, y: 0, width: CGFloat(w), height: CGFloat(h)))
    ctx.scaleBy(x: scale, y: scale)
    ctx.drawPDFPage(page)
    guard let img = ctx.makeImage() else { fatalError("no image") }
    let out = URL(fileURLWithPath: String(format: "%@-p%02d.png", prefix, i))
    guard let dest = CGImageDestinationCreateWithURL(out as CFURL, UTType.png.identifier as CFString, 1, nil) else { fatalError("no destination") }
    CGImageDestinationAddImage(dest, img, nil)
    CGImageDestinationFinalize(dest)
}
print("\(prefix): \(doc.numberOfPages) pages")
