import React from "react";
import { ImageResponse } from "next/og";

export const runtime = "edge";

const supportedSizes = new Set([192, 512]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ size: string }> },
) {
  const { size: rawSize } = await params;
  const size = Number(rawSize);

  if (!supportedSizes.has(size)) {
    return new Response("Not found", { status: 404 });
  }

  const scale = size / 64;

  return new ImageResponse(
    React.createElement(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b2f27",
          borderRadius: String(14 * scale) + "px",
          color: "#d5ddda",
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: String(22 * scale) + "px",
          fontWeight: 800,
          letterSpacing: String(-1.8 * scale) + "px",
        },
      },
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: String(2.5 * scale) + "px",
          },
        },
        React.createElement("span", { style: { color: "#78b7a5" } }, "S"),
        React.createElement("span", { style: { color: "#d5ddda" } }, "S"),
        React.createElement("span", { style: { color: "#438d7a" } }, "S"),
      ),
    ),
    { width: size, height: size },
  );
}