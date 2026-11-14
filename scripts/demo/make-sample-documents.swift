// Draws the fictional documents used for screenshots and the README demo:
// a "Republic of Example" passport, a car insurance card, a coffee receipt
// and a two-page lease PDF. Every one is marked SPECIMEN or SAMPLE and uses
// made-up names, numbers and places; never replace them with real documents.
//
//   swift scripts/demo/make-sample-documents.swift <output folder>

import AppKit

let output = URL(fileURLWithPath: CommandLine.arguments.dropFirst().first ?? "sample-documents", isDirectory: true)
try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)

func font(_ size: CGFloat, _ weight: NSFont.Weight = .regular, mono: Bool = false) -> NSFont {
  mono ? .monospacedSystemFont(ofSize: size, weight: weight) : .systemFont(ofSize: size, weight: weight)
}

func text(_ string: String, _ point: CGPoint, _ size: CGFloat, _ weight: NSFont.Weight = .regular,
          color: NSColor = .black, mono: Bool = false) {
  NSAttributedString(string: string, attributes: [.font: font(size, weight, mono: mono), .foregroundColor: color])
    .draw(at: point)
}

func box(_ rect: CGRect, _ color: NSColor, radius: CGFloat = 0) {
  color.setFill()
  NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius).fill()
}

/// A diagonal stamp across the page, so no one mistakes the sample for the real thing.
func stamp(_ word: String, in size: CGSize) {
  guard let context = NSGraphicsContext.current?.cgContext else { return }
  context.saveGState()
  context.translateBy(x: size.width / 2, y: size.height / 2)
  context.rotate(by: .pi / 9)
  let attributed = NSAttributedString(string: word, attributes: [
    .font: font(size.width / 7, .heavy), .foregroundColor: NSColor.systemRed.withAlphaComponent(0.22),
  ])
  let measured = attributed.size()
  attributed.draw(at: CGPoint(x: -measured.width / 2, y: -measured.height / 2))
  context.restoreGState()
}

/// Draws with a top-left origin, which reads more naturally for documents.
func image(_ name: String, _ size: CGSize, draw: (CGSize) -> Void) throws {
  let rep = NSBitmapImageRep(
    bitmapDataPlanes: nil, pixelsWide: Int(size.width), pixelsHigh: Int(size.height), bitsPerSample: 8,
    samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0
  )!
  NSGraphicsContext.saveGraphicsState()
  let context = NSGraphicsContext(bitmapImageRep: rep)!
  NSGraphicsContext.current = context
  context.cgContext.translateBy(x: 0, y: size.height)
  context.cgContext.scaleBy(x: 1, y: -1)
  NSGraphicsContext.current = NSGraphicsContext(cgContext: context.cgContext, flipped: true)
  draw(size)
  NSGraphicsContext.restoreGraphicsState()
  let jpeg = rep.representation(using: .jpeg, properties: [.compressionFactor: 0.88])!
  try jpeg.write(to: output.appendingPathComponent(name))
}

// Passport data page.
try image("passport-republic-of-example.jpg", CGSize(width: 1500, height: 1050)) { size in
  box(CGRect(origin: .zero, size: size), NSColor(calibratedRed: 0.93, green: 0.95, blue: 0.97, alpha: 1))
  box(CGRect(x: 0, y: 0, width: size.width, height: 120), NSColor(calibratedRed: 0.10, green: 0.23, blue: 0.45, alpha: 1))
  text("REPUBLIC OF EXAMPLE", CGPoint(x: 60, y: 28), 46, .bold, color: .white)
  text("PASSPORT · PASSEPORT", CGPoint(x: 1000, y: 40), 30, .semibold, color: .white)
  box(CGRect(x: 60, y: 180, width: 340, height: 440), NSColor(white: 0.78, alpha: 1), radius: 12)
  NSColor(white: 0.62, alpha: 1).setFill()
  NSBezierPath(ovalIn: CGRect(x: 160, y: 250, width: 140, height: 160)).fill()
  NSBezierPath(roundedRect: CGRect(x: 110, y: 430, width: 240, height: 190), xRadius: 100, yRadius: 100).fill()
  let fields: [(String, String)] = [
    ("Type / Code", "P   EXM"), ("Passport No.", "X0000000"), ("Surname", "EXAMPLE"),
    ("Given names", "ALEX SAMPLE"), ("Nationality", "EXAMPLIAN"), ("Date of birth", "01 JAN 1990"),
    ("Date of issue", "15 NOV 2021"), ("Date of expiry", "14 NOV 2031"),
  ]
  for (index, field) in fields.enumerated() {
    let x: CGFloat = index % 2 == 0 ? 460 : 960
    let y = 180 + CGFloat(index / 2) * 110
    text(field.0, CGPoint(x: x, y: y), 24, color: .darkGray)
    text(field.1, CGPoint(x: x, y: y + 32), 40, .semibold)
  }
  box(CGRect(x: 0, y: 820, width: size.width, height: 230), .white)
  text("P<EXMEXAMPLE<<ALEX<SAMPLE<<<<<<<<<<<<<<<<<<<", CGPoint(x: 60, y: 860), 46, mono: true)
  text("X0000000<0EXM9001011M3111143<<<<<<<<<<<<<<00", CGPoint(x: 60, y: 940), 46, mono: true)
  stamp("SPECIMEN", in: size)
}

// Car insurance card.
try image("insurance-card-example-mutual.jpg", CGSize(width: 1400, height: 880)) { size in
  box(CGRect(origin: .zero, size: size), .white)
  box(CGRect(x: 0, y: 0, width: size.width, height: 170), NSColor(calibratedRed: 0.05, green: 0.47, blue: 0.43, alpha: 1))
  text("Example Mutual", CGPoint(x: 60, y: 36), 58, .bold, color: .white)
  text("Motor insurance certificate", CGPoint(x: 60, y: 108), 30, color: .white)
  let lines: [(String, String)] = [
    ("Policy number", "EXM-2026-004217"), ("Policyholder", "Alex Sample"),
    ("Vehicle", "Example Motors Hatchback, 2022"), ("Registration", "EX 2468"),
    ("Cover", "Comprehensive"), ("Valid", "1 Jan 2026 to 31 Dec 2026"),
  ]
  for (index, line) in lines.enumerated() {
    let y = 220 + CGFloat(index) * 92
    text(line.0, CGPoint(x: 60, y: y), 28, color: .darkGray)
    text(line.1, CGPoint(x: 460, y: y - 6), 40, .semibold)
  }
  text("Claims: 800 000 000 (sample number)", CGPoint(x: 60, y: 800), 26, color: .darkGray)
  stamp("SAMPLE", in: size)
}

// Coffee receipt.
try image("receipt-sample-coffee.jpg", CGSize(width: 760, height: 1300)) { size in
  box(CGRect(origin: .zero, size: size), NSColor(white: 0.985, alpha: 1))
  text("SAMPLE COFFEE CO.", CGPoint(x: 150, y: 70), 44, .bold, mono: true)
  text("1 Placeholder Square, Example City", CGPoint(x: 92, y: 140), 26, mono: true)
  text("14/11/2026  09:41      Receipt 0042", CGPoint(x: 60, y: 230), 26, mono: true)
  let items = [("Flat white", "4.20"), ("Almond croissant", "3.80"), ("Sparkling water", "2.50"), ("Oat milk", "0.40")]
  for (index, item) in items.enumerated() {
    let y = 320 + CGFloat(index) * 70
    text(item.0, CGPoint(x: 60, y: y), 32, mono: true)
    text(item.1, CGPoint(x: 590, y: y), 32, mono: true)
  }
  box(CGRect(x: 60, y: 620, width: 640, height: 3), .black)
  text("TOTAL", CGPoint(x: 60, y: 650), 40, .bold, mono: true)
  text("10.90", CGPoint(x: 560, y: 650), 40, .bold, mono: true)
  text("Card ending 0000 (sample)", CGPoint(x: 60, y: 740), 28, mono: true)
  text("Thank you!", CGPoint(x: 260, y: 1120), 34, mono: true)
  stamp("SAMPLE", in: size)
}

// Two-page lease agreement.
let page = CGRect(x: 0, y: 0, width: 612, height: 792)
var mediaBox = page
let pdf = CGContext(output.appendingPathComponent("lease-agreement-sample.pdf") as CFURL, mediaBox: &mediaBox, nil)!
let pages: [(String, [String])] = [
  ("Residential Lease Agreement", [
    "This sample agreement is made on 1 March 2026 between",
    "Example Properties LLC (the Landlord) and Alex Sample (the Tenant).",
    "",
    "1. Property. Flat 3, 12 Placeholder Street, Example City.",
    "2. Term. Twelve months, from 1 March 2026 to 28 February 2027.",
    "3. Rent. 1,200 example credits per month, due on the first day.",
    "4. Deposit. One month's rent, held for the length of the term.",
    "5. Utilities. Water included; electricity and internet by the Tenant.",
  ]),
  ("Residential Lease Agreement, page 2", [
    "6. Repairs. The Landlord keeps the structure and appliances in order.",
    "7. Notice. Either party may end the lease with 60 days' written notice.",
    "8. Pets. One cat, with the Landlord's written consent.",
    "",
    "Signed for the Landlord: ______________________",
    "Signed by the Tenant:    ______________________",
    "",
    "This is a fictional sample document for software demonstrations.",
  ]),
]
for (title, lines) in pages {
  pdf.beginPDFPage(nil)
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(cgContext: pdf, flipped: false)
  text(title, CGPoint(x: 60, y: 700), 22, .bold)
  for (index, line) in lines.enumerated() {
    text(line, CGPoint(x: 60, y: 640 - CGFloat(index) * 30), 13)
  }
  stamp("SAMPLE", in: page.size)
  NSGraphicsContext.restoreGraphicsState()
  pdf.endPDFPage()
}
pdf.closePDF()

print("Wrote the sample documents to \(output.path)")
