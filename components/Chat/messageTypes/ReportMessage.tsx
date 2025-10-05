import React, { useState } from "react";
import { ReportMessage as ReportMessageType } from "./types";
import { formatTimestamp } from "../../../utils/utils";
import {
  Download,
  Building2,
  MapPin,
  Users,
  Calendar,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface ReportMessageProps {
  message: ReportMessageType;
}

export function ReportMessage({ message }: ReportMessageProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const { metadata, filePath, summary, peFunds } = message;

  const handleDownload = async () => {
    try {
      // Convert absolute path to relative path from project root
      const relativePath = filePath.replace(
        /^.*\/(agent\/logs\/[^/]+\.md)$/,
        "$1"
      );
      // Read the markdown file and convert to PDF on-the-fly
      const response = await fetch(
        `/api/download?path=${encodeURIComponent(relativePath)}`
      );
      if (!response.ok) throw new Error("Failed to download PDF report");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      const fileName =
        filePath.split("/").pop()?.replace(/\.md$/, "") || "analysis-report";
      a.href = url;
      a.download = `${fileName}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download failed:", error);
      alert("Failed to download PDF report. Please try again.");
    }
  };

  return (
    <div className="mb-4 border border-blue-200 bg-blue-50 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-blue-100 border-b border-blue-200">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-semibold text-blue-900 uppercase tracking-wider">
              Company Analysis Report
            </span>
          </div>
          <span className="text-xs text-blue-600">
            {formatTimestamp(message.timestamp)}
          </span>
        </div>
      </div>

      {/* Company Metadata Cards */}
      <div className="p-4 bg-white border-b border-blue-200">
        <h3 className="text-lg font-bold text-gray-900 mb-3">
          {metadata.company}
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
              <Building2 className="w-3 h-3" />
              <span className="font-semibold">Industry</span>
            </div>
            <div className="text-sm text-gray-900">{metadata.industry}</div>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
              <MapPin className="w-3 h-3" />
              <span className="font-semibold">Location</span>
            </div>
            <div className="text-sm text-gray-900">{metadata.location}</div>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
              <Users className="w-3 h-3" />
              <span className="font-semibold">Size</span>
            </div>
            <div className="text-sm text-gray-900">{metadata.size}</div>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
              <Calendar className="w-3 h-3" />
              <span className="font-semibold">Analyzed</span>
            </div>
            <div className="text-sm text-gray-900">{metadata.analyzed}</div>
          </div>
        </div>

        {/* URL Link */}
        <a
          href={metadata.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:text-blue-800 underline"
        >
          {metadata.url}
        </a>
      </div>

      {/* Key Findings */}
      <div className="p-4 bg-white border-b border-blue-200">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">
          Key Findings
        </h4>
        <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">
          {summary}
        </div>
      </div>

      {/* PE Funds Section */}
      {peFunds && peFunds.length > 0 && (
        <div className="bg-white border-b border-blue-200">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <h4 className="text-sm font-semibold text-gray-700">
              Shortlist of P.E Buyers ({peFunds.length})
            </h4>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-gray-600" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-600" />
            )}
          </button>

          {isExpanded && (
            <div className="px-4 pb-4 space-y-3">
              {peFunds.map((fund, index) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg p-3 bg-gray-50"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h5 className="font-semibold text-gray-900">{fund.name}</h5>
                    {fund.website && (
                      <a
                        href={fund.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-800 underline"
                      >
                        Visit
                      </a>
                    )}
                  </div>

                  <div className="space-y-1 text-xs text-gray-700">
                    <div>
                      <span className="font-semibold">Focus:</span>{" "}
                      {fund.investmentFocus}
                    </div>
                    {fund.checkSize && (
                      <div>
                        <span className="font-semibold">Check Size:</span>{" "}
                        {fund.checkSize}
                      </div>
                    )}
                    <div>
                      <span className="font-semibold">Fit:</span>{" "}
                      {fund.fitRationale}
                    </div>
                    {fund.recentInvestments &&
                      fund.recentInvestments.length > 0 && (
                        <div>
                          <span className="font-semibold">
                            Recent Investments:
                          </span>{" "}
                          {fund.recentInvestments.join(", ")}
                        </div>
                      )}
                    {fund.contact && (
                      <div>
                        <span className="font-semibold">Contact:</span>{" "}
                        {fund.contact}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Download Button */}
      <div className="p-4 bg-gray-50">
        <button
          onClick={handleDownload}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          <span className="text-sm font-medium">Download PDF Report</span>
        </button>
      </div>
    </div>
  );
}
