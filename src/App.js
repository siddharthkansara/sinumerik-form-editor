import React, { useState, useRef } from "react";
import { Slider, Button } from "@mui/material";

export default function App() {
  const [caption, setCaption] = useState("");
  const [elements, setElements] = useState([]);
  const [originalElements, setOriginalElements] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [draggingId, setDraggingId] = useState(null);

  const [globalFontScale, setGlobalFontScale] = useState(1);
  const [lineSpacingScale, setLineSpacingScale] = useState(1);

  // Undo/redo stacks
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  const offsetRef = useRef({ x: 0, y: 0 });
  const GRID_SIZE = 20;

  const selectedEl = elements.find((el) => el.id === selectedId);

  // push state snapshot to undo stack
  const pushState = (newElements, newFontScale, newLineScale) => {
    setUndoStack((prev) => [
      ...prev,
      {
        elements: JSON.parse(JSON.stringify(newElements)),
        fontScale: newFontScale,
        lineScale: newLineScale,
      },
    ]);
    setRedoStack([]); // clear redo after new action
  };

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
        content: node.textContent || "",
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

    const clone = JSON.parse(JSON.stringify(items));
    setElements(clone);
    setOriginalElements(clone);
    setSelectedId(null);
    setGlobalFontScale(1);
    setLineSpacingScale(1);
    setUndoStack([]);
    setRedoStack([]);
    pushState(clone, 1, 1);
  };

  const updateSelected = (field, value) => {
    const newEls = elements.map((el) =>
      el.id === selectedId ? { ...el, [field]: value } : el
    );
    setElements(newEls);
    pushState(newEls, globalFontScale, lineSpacingScale);
  };

  const updateGlobalScale = (value) => {
    setGlobalFontScale(value);
    pushState(elements, value, lineSpacingScale);
  };

  const updateLineSpacing = (value) => {
    setLineSpacingScale(value);
    pushState(elements, globalFontScale, value);
  };

  const downloadXML = () => {
    let xml = `<?xml version="1.0"?>\n<form>\n<init>\n<caption>${escapeXml(
      caption
    )}</caption>\n`;

    elements
      .filter((el) => el.type !== "label")
      .forEach((el) => {
        const nameEsc = escapeXml(el.id);
        const refvarEsc = escapeXml(el.refvar || "");
        xml += `<control name="${nameEsc}" xpos="${Math.round(
          el.x
        )}" ypos="${Math.round(el.y * lineSpacingScale)}" ${
          el.type === "readonly" ? 'fieldtype="readonly" ' : ""
        }refvar="${refvarEsc}" hotlink="true"/>\n`;
      });

    xml += `</init>\n<paint>\n`;
    elements
      .filter((el) => el.type === "label")
      .forEach((el) => {
        const base = el.fontSize || 14;
        const effectiveFontSize = Math.round(base * globalFontScale);
        const style = ` style="font-size:${effectiveFontSize}px"`;
        const contentEsc = escapeXml(el.content || "");
        const colorEsc = escapeXml(el.color || "#000");
        xml += `<text xpos="${Math.round(el.x)}" ypos="${Math.round(
          el.y * lineSpacingScale
        )}" color="${colorEsc}"${style}>${contentEsc}</text>\n`;
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

  const escapeXml = (unsafe) => {
    if (unsafe === undefined || unsafe === null) return "";
    return unsafe
      .toString()
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&apos;");
  };

  const resetToOriginal = () => {
    if (
      window.confirm(
        "Are you sure you want to reset? All unsaved changes will be lost."
      )
    ) {
      const clone = JSON.parse(JSON.stringify(originalElements));
      setElements(clone);
      setSelectedId(null);
      setGlobalFontScale(1);
      setLineSpacingScale(1);
      setUndoStack([]);
      setRedoStack([]);
      pushState(clone, 1, 1);
    }
  };

  const undo = () => {
    if (undoStack.length < 2) return;
    const current = undoStack[undoStack.length - 1];
    const prev = undoStack[undoStack.length - 2];
    setRedoStack((r) => [current, ...r]);
    setUndoStack((u) => u.slice(0, -1));
    setElements(JSON.parse(JSON.stringify(prev.elements)));
    setGlobalFontScale(prev.fontScale);
    setLineSpacingScale(prev.lineScale);
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    setRedoStack((r) => r.slice(1));
    setUndoStack((u) => [...u, next]);
    setElements(JSON.parse(JSON.stringify(next.elements)));
    setGlobalFontScale(next.fontScale);
    setLineSpacingScale(next.lineScale);
  };

  // ---- Drag Handlers with snap-to-grid ----
  const handleMouseDown = (el, e) => {
    setSelectedId(el.id);
    setDraggingId(el.id);
    offsetRef.current = {
      x: e.clientX - el.x,
      y: e.clientY - el.y * lineSpacingScale,
    };
    e.preventDefault();
  };

  const handleMouseMove = (e) => {
    if (!draggingId) return;
    const { x: offsetX, y: offsetY } = offsetRef.current;
    let newX = e.clientX - offsetX;
    let newY = e.clientY - offsetY;

    newX = Math.round(newX / GRID_SIZE) * GRID_SIZE;
    newY = Math.round(newY / GRID_SIZE) * GRID_SIZE;

    // invert line spacing to get back to base y
    const baseY = newY / lineSpacingScale;

    const newEls = elements.map((el) =>
      el.id === draggingId ? { ...el, x: newX, y: baseY } : el
    );
    setElements(newEls);
  };

  const handleMouseUp = () => {
    if (draggingId) {
      pushState(elements, globalFontScale, lineSpacingScale);
      setDraggingId(null);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        fontFamily: "Inter, sans-serif",
        height: "100vh",
        background: "#f8f9fb",
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* HEADER */}
      <header
        style={{
          background: "#003366",
          color: "white",
          padding: "10px 20px",
          fontSize: "20px",
          fontWeight: "600",
          display: "flex",
          alignItems: "center",
          gap: "20px",
        }}
      >
        <div>Sinumerik Form Editor</div>

        {/* Font scale slider */}
        <div
          style={{
            width: 220,
            background: "white",
            color: "#333",
            borderRadius: "6px",
            padding: "8px 10px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div style={{ fontSize: 12 }}>Global Font Scale</div>
          <Slider
            value={globalFontScale}
            min={0.5}
            max={2}
            step={0.1}
            onChange={(e, v) =>
              updateGlobalScale(typeof v === "number" ? v : 1)
            }
            size="small"
          />
        </div>

        {/* Line spacing slider */}
        <div
          style={{
            width: 220,
            background: "white",
            color: "#333",
            borderRadius: "6px",
            padding: "8px 10px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div style={{ fontSize: 12 }}>Global Line Spacing</div>
          <Slider
            value={lineSpacingScale}
            min={0.5}
            max={3}
            step={0.1}
            onChange={(e, v) =>
              updateLineSpacing(typeof v === "number" ? v : 1)
            }
            size="small"
          />
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <Button
            variant="contained"
            color="secondary"
            onClick={downloadXML}
          >
            Save (Download XML)
          </Button>

          <Button
            variant="outlined"
            style={{ color: "white", borderColor: "white" }}
            onClick={resetToOriginal}
          >
            Reset
          </Button>

          <Button
            variant="outlined"
            style={{ color: "white", borderColor: "white" }}
            onClick={undo}
            disabled={undoStack.length < 2}
          >
            Undo
          </Button>

          <Button
            variant="outlined"
            style={{ color: "white", borderColor: "white" }}
            onClick={redo}
            disabled={redoStack.length === 0}
          >
            Redo
          </Button>
        </div>
      </header>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div style={{ flex: 1, padding: 20 }}>
          <div style={{ marginBottom: 10 }}>
            <input
              type="file"
              onChange={handleFile}
              accept=".xml,.frm,.txt"
              style={{ padding: "6px" }}
            />
            {caption && (
              <h3 style={{ marginTop: 10, color: "#333" }}>{caption}</h3>
            )}
          </div>

          <div
            style={{
              position: "relative",
              width: "100%",
              height: "70vh",
              border: "2px dashed #ccc",
              borderRadius: "8px",
              overflow: "auto",
              backgroundImage:
                "linear-gradient(to right, #e0e0e0 1px, transparent 1px), linear-gradient(to bottom, #e0e0e0 1px, transparent 1px)",
              backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
              backgroundColor: "#fff",
            }}
          >
            {elements.map((el) => {
              const commonStyle = {
                position: "absolute",
                left: el.x,
                top: el.y * lineSpacingScale,
                cursor: "move",
                outline: selectedId === el.id ? "2px solid orange" : "none",
                userSelect: "none",
              };

              if (el.type === "label") {
                return (
                  <div
                    key={el.id}
                    style={{
                      ...commonStyle,
                      color: el.color,
                      fontSize: (el.fontSize || 14) * globalFontScale,
                      padding: "2px 4px",
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
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, marginBottom: 4 }}>Font Size</div>
                  <Slider
                    value={selectedEl.fontSize || 14}
                    min={8}
                    max={48}
                    step={1}
                    onChange={(e, v) =>
                      updateSelected("fontSize", typeof v === "number" ? v : 14)
                    }
                  />
                  <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
                    Effective size (after global scale):{" "}
                    <strong>
                      {Math.round((selectedEl.fontSize || 14) * globalFontScale)}px
                    </strong>
                  </div>
                </div>
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

      <footer
        style={{
          textAlign: "center",
          padding: "10px",
          background: "#f0f0f0",
          fontSize: "14px",
        }}
      >
        Designed &amp; Developed by <strong>Siddharth Kansara</strong> @SKGroup
      </footer>
    </div>
  );
}
