import React, { useState, useRef } from "react";

export default function App() {
  const [caption, setCaption] = useState("");
  const [elements, setElements] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const offsetRef = useRef({ x: 0, y: 0 });

  const handleFile = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      parseForm(e.target.result);
    };
    reader.readAsText(file);
  };

  const parseForm = (text) => {
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, "application/xml");
    const items = [];

    const capNode = xml.querySelector("caption");
    setCaption(capNode ? capNode.textContent.trim() : "");

    xml.querySelectorAll("text").forEach((node, idx) => {
      const style = node.getAttribute("style") || "";
      const match = style.match(/font-size:\s*(\d+)px/);
      const fs = match ? parseInt(match[1], 10) : 14;
      items.push({
        id: "label-" + idx,
        type: "label",
        x: Number(node.getAttribute("xpos")),
        y: Number(node.getAttribute("ypos")),
        color: node.getAttribute("color") || "#000",
        content: node.textContent,
        fontSize: fs,
      });
    });

    xml.querySelectorAll("control").forEach((node, idx) => {
      const fieldtype = node.getAttribute("fieldtype") || "";
      const refvar = node.getAttribute("refvar") || "";
      items.push({
        id: node.getAttribute("name") || "control-" + idx,
        type: fieldtype === "readonly" ? "readonly" : "checkbox",
        x: Number(node.getAttribute("xpos")),
        y: Number(node.getAttribute("ypos")),
        color: "#000",
        content: "",
        refvar,
      });
    });

    setElements(items);
    setSelectedId(null);
  };

  const selectedEl = elements.find((el) => el.id === selectedId);

  const updateSelected = (field, value) => {
    setElements((prev) =>
      prev.map((el) =>
        el.id === selectedId ? { ...el, [field]: value } : el
      )
    );
  };

  const downloadXML = () => {
    let xml = `<?xml version="1.0"?>\n<form>\n<init>\n<caption>${caption}</caption>\n`;
    elements
      .filter((el) => el.type !== "label")
      .forEach((el) => {
        xml += `<control name="${el.id}" xpos="${el.x}" ypos="${el.y}" ${
          el.type === "readonly" ? 'fieldtype="readonly" ' : ""
        }refvar="${el.refvar || ""}" hotlink="true"/>\n`;
      });
    xml += `</init>\n<paint>\n`;
    elements
      .filter((el) => el.type === "label")
      .forEach((el) => {
        const style =
          el.fontSize && el.fontSize !== 14
            ? ` style="font-size:${el.fontSize}px"`
            : "";
        xml += `<text xpos="${el.x}" ypos="${el.y}" color="${el.color}"${style}>${el.content}</text>\n`;
      });
    xml += `</paint>\n</form>`;

    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "updated_form.xml";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---- Drag Handlers ----
  const handleMouseDown = (el, e) => {
    setSelectedId(el.id);
    setDraggingId(el.id);
    offsetRef.current = {
      x: e.clientX - el.x,
      y: e.clientY - el.y,
    };
  };

  const handleMouseMove = (e) => {
    if (!draggingId) return;
    const { x: offsetX, y: offsetY } = offsetRef.current;
    const newX = e.clientX - offsetX;
    const newY = e.clientY - offsetY;
    setElements((prev) =>
      prev.map((el) =>
        el.id === draggingId ? { ...el, x: newX, y: newY } : el
      )
    );
  };

  const handleMouseUp = () => {
    setDraggingId(null);
  };

  return (
    <div
      style={{ display: "flex", fontFamily: "sans-serif", height: "100vh" }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <div style={{ flex: 1, padding: 20 }}>
        <h2>Sinumerik Form Editor (Drag & Drop)</h2>
        <input type="file" onChange={handleFile} accept=".xml,.frm,.txt" />
        {caption && <h3>{caption}</h3>}
        <div
          style={{
            position: "relative",
            marginTop: 20,
            width: 900,
            height: 700,
            border: "1px solid #ccc",
            overflow: "auto",
            background: "#fafafa",
          }}
        >
          {elements.map((el) => {
            const commonStyle = {
              position: "absolute",
              left: el.x,
              top: el.y,
              cursor: "move",
              outline: selectedId === el.id ? "2px solid orange" : "none",
            };

            if (el.type === "label") {
              return (
                <div
                  key={el.id}
                  style={{
                    ...commonStyle,
                    color: el.color,
                    fontSize: el.fontSize || 14,
                  }}
                  onMouseDown={(e) => handleMouseDown(el, e)}
                >
                  {el.content}
                </div>
              );
            } else if (el.type === "checkbox") {
              return (
                <input
                  key={el.id}
                  type="checkbox"
                  title={el.refvar}
                  style={commonStyle}
                  onMouseDown={(e) => handleMouseDown(el, e)}
                />
              );
            } else if (el.type === "readonly") {
              return (
                <input
                  key={el.id}
                  type="text"
                  readOnly
                  title={el.refvar}
                  placeholder={el.refvar}
                  style={{
                    ...commonStyle,
                    width: 150,
                    backgroundColor: "#f0f0f0",
                    border: "1px solid #ccc",
                  }}
                  onMouseDown={(e) => handleMouseDown(el, e)}
                />
              );
            }
            return null;
          })}
        </div>
        <button
          onClick={downloadXML}
          style={{ marginTop: 10, padding: "6px 12px" }}
        >
          Download Updated XML
        </button>
      </div>

      {selectedEl && (
        <div
          style={{
            width: 300,
            borderLeft: "1px solid #ccc",
            padding: 20,
            background: "#f9f9f9",
          }}
        >
          <h4>Edit {selectedEl.id}</h4>
          <label>
            X:
            <input
              type="number"
              value={Math.round(selectedEl.x)}
              onChange={(e) => updateSelected("x", +e.target.value)}
            />
          </label>
          <br />
          <label>
            Y:
            <input
              type="number"
              value={Math.round(selectedEl.y)}
              onChange={(e) => updateSelected("y", +e.target.value)}
            />
          </label>
          <br />
          {selectedEl.type === "label" && (
            <>
              <label>
                Text:
                <input
                  type="text"
                  value={selectedEl.content}
                  onChange={(e) => updateSelected("content", e.target.value)}
                />
              </label>
              <br />
              <label>
                Color:
                <input
                  type="color"
                  value={selectedEl.color}
                  onChange={(e) => updateSelected("color", e.target.value)}
                />
              </label>
              <br />
              <label>
                Font Size (px):
                <input
                  type="number"
                  value={selectedEl.fontSize || 14}
                  onChange={(e) => updateSelected("fontSize", +e.target.value)}
                />
              </label>
              <br />
            </>
          )}
          {selectedEl.type !== "label" && (
            <>
              <label>
                Refvar:
                <input
                  type="text"
                  value={selectedEl.refvar}
                  onChange={(e) => updateSelected("refvar", e.target.value)}
                />
              </label>
              <br />
            </>
          )}
        </div>
      )}
    </div>
  );
}
