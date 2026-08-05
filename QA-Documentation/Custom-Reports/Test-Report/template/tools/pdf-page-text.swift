// Per-page text of a PDF, for tools that must know WHICH PAGE something landed on
// (the Test-report TOC bake loop reads heading pages out of a real render).
//
//   swift pdf-page-text.swift <file.pdf> [page]
//     no page → every page, each preceded by a "\u{0C}=== page N ===" marker line
//     page    → just that page's text
//
// Exists so the kit does not REQUIRE poppler: `pdftotext` is faster and is preferred when
// present, but a colleague's clean clone has only macOS. Same fallback shape as
// render-pdf.swift (see tr-render.mjs). PDFKit ships with macOS — no brew, no npm.
import Foundation
import PDFKit

let args = CommandLine.arguments
guard args.count >= 2 else {
    FileHandle.standardError.write("usage: swift pdf-page-text.swift <file.pdf> [page]\n".data(using: .utf8)!)
    exit(2)
}
let url = URL(fileURLWithPath: args[1])
guard let doc = PDFDocument(url: url) else {
    FileHandle.standardError.write("cannot open PDF: \(args[1])\n".data(using: .utf8)!)
    exit(1)
}

func text(of index: Int) -> String {
    guard index >= 0, index < doc.pageCount, let page = doc.page(at: index) else { return "" }
    return page.string ?? ""
}

if args.count >= 3, let want = Int(args[2]) {
    guard want >= 1, want <= doc.pageCount else {
        FileHandle.standardError.write("page \(want) out of range (1...\(doc.pageCount))\n".data(using: .utf8)!)
        exit(1)
    }
    print(text(of: want - 1))
} else {
    for i in 0..<doc.pageCount {
        print("=== page \(i + 1) ===")
        print(text(of: i))
    }
}
