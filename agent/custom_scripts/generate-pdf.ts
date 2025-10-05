/**
 * PDF Generation Utility for Analysis Reports
 *
 * This script converts markdown analysis reports to PDF format.
 * Usage: bun run agent/custom_scripts/generate-pdf.ts <markdown-file-path>
 */

import { mdToPdf } from "md-to-pdf";
import { readFile, writeFile } from "fs/promises";
import { join, dirname, basename, extname } from "path";

async function generatePDF(mdFilePath: string): Promise<string> {
  try {
    console.log(`Converting ${mdFilePath} to PDF...`);

    // Read the markdown file
    const mdContent = await readFile(mdFilePath, "utf-8");

    // Generate PDF
    const pdf = await mdToPdf(
      { content: mdContent },
      {
        dest: mdFilePath.replace(/\.md$/, ".pdf"),
        stylesheet: [
          "https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.2.0/github-markdown.min.css",
        ],
        body_class: "markdown-body",
        css: `
          .markdown-body {
            box-sizing: border-box;
            min-width: 200px;
            max-width: 980px;
            margin: 0 auto;
            padding: 45px;
          }

          @media (max-width: 767px) {
            .markdown-body {
              padding: 15px;
            }
          }

          table {
            border-collapse: collapse;
            width: 100%;
            margin: 1em 0;
          }

          th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
          }

          th {
            background-color: #f2f2f2;
            font-weight: bold;
          }
        `,
        pdf_options: {
          format: "A4",
          margin: {
            top: "20mm",
            right: "20mm",
            bottom: "20mm",
            left: "20mm",
          },
          printBackground: true,
        },
      }
    );

    const pdfPath = mdFilePath.replace(/\.md$/, ".pdf");
    console.log(`✓ PDF generated successfully: ${pdfPath}`);

    return pdfPath;
  } catch (error) {
    console.error("Failed to generate PDF:", error);
    throw error;
  }
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Usage: bun run generate-pdf.ts <markdown-file-path>");
    process.exit(1);
  }

  const mdFile = args[0];

  generatePDF(mdFile)
    .then((pdfPath) => {
      console.log("Done!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Error:", error);
      process.exit(1);
    });
}

export { generatePDF };
