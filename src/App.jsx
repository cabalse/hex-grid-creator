import { useState } from 'react'
import { Stage, Layer, RegularPolygon } from 'react-konva'
import './App.css'

const BASE_PADDING = 10

// Hexes are positioned so their mathematical edges coincide with neighbours.
// Because Konva strokes are centred on the path, two adjacent hexes draw their
// stroke over exactly the same pixels → the shared border always appears as
// strokeWidth, never 2×strokeWidth.
function computeGrid(cols, rows, R, orientation, strokeWidth) {
  const pad = BASE_PADDING + strokeWidth / 2
  const raw = []

  if (orientation === 'side') {
    // Flat-top: vertices left/right, flat edges top/bottom
    // Horizontal neighbour spacing = 1.5R, vertical = √3·R
    // Odd columns shift down by √3/2·R
    const cxStep = 1.5 * R
    const ryStep = Math.sqrt(3) * R
    for (let c = 0; c < cols; c++) {
      const yOff = c % 2 === 1 ? ryStep / 2 : 0
      for (let r = 0; r < rows; r++) {
        raw.push({ x: c * cxStep, y: r * ryStep + yOff })
      }
    }
  } else {
    // Point-top: vertices top/bottom, flat edges left/right
    // Vertical neighbour spacing = 1.5R, horizontal = √3·R
    // Odd rows shift right by √3/2·R
    const cxStep = Math.sqrt(3) * R
    const ryStep = 1.5 * R
    for (let r = 0; r < rows; r++) {
      const xOff = r % 2 === 1 ? cxStep / 2 : 0
      for (let c = 0; c < cols; c++) {
        raw.push({ x: c * cxStep + xOff, y: r * ryStep })
      }
    }
  }

  // Half-extents of each hex's bounding box
  const halfW = orientation === 'side' ? R : (Math.sqrt(3) / 2) * R
  const halfH = orientation === 'side' ? (Math.sqrt(3) / 2) * R : R

  const xs = raw.map(p => p.x)
  const ys = raw.map(p => p.y)
  const minX = Math.min(...xs) - halfW
  const maxX = Math.max(...xs) + halfW
  const minY = Math.min(...ys) - halfH
  const maxY = Math.max(...ys) + halfH

  const shiftX = pad - minX
  const shiftY = pad - minY

  return {
    positions: raw.map(p => ({ x: p.x + shiftX, y: p.y + shiftY })),
    canvasWidth:  maxX - minX + 2 * pad,
    canvasHeight: maxY - minY + 2 * pad,
  }
}

// Rotation: Konva's RegularPolygon defaults to point-up.
// Rotating 30° gives flat-top (side-up).
const ROTATION = { side: 30, point: 0 }

function App() {
  const [hexWidth,    setHexWidth]    = useState('')
  const [cols,        setCols]        = useState('1')
  const [rows,        setRows]        = useState('1')
  const [orientation, setOrientation] = useState('side')
  const [strokeColor, setStrokeColor] = useState('#000000')
  const [strokeWidth, setStrokeWidth] = useState('1')
  const [drawnProps,  setDrawnProps]  = useState(null)

  const handleDraw = () => {
    const R  = parseFloat(hexWidth) / 2
    const sw = Math.max(1, parseFloat(strokeWidth) || 1)
    const c  = Math.max(1, parseInt(cols)  || 1)
    const r  = Math.max(1, parseInt(rows)  || 1)
    if (!isFinite(R) || R <= 0) return

    const grid = computeGrid(c, r, R, orientation, sw)
    setDrawnProps({
      radius:      R,
      rotation:    ROTATION[orientation],
      stroke:      strokeColor,
      strokeWidth: sw,
      ...grid,
    })
  }

  return (
    <main id="app">
      <h1>Hex Grid Creator</h1>

      <div className="controls">
        <div className="controls-row">
          <label htmlFor="hex-width">Hex size (px)</label>
          <input
            id="hex-width"
            type="number"
            min="4"
            value={hexWidth}
            onChange={(e) => setHexWidth(e.target.value)}
            placeholder="e.g. 80"
          />

          <label htmlFor="orientation">Orientation</label>
          <select
            id="orientation"
            value={orientation}
            onChange={(e) => setOrientation(e.target.value)}
          >
            <option value="side">Side up</option>
            <option value="point">Point up</option>
          </select>

          <label htmlFor="rows">Rows</label>
          <input
            id="rows"
            type="number"
            min="1"
            max="100"
            value={rows}
            onChange={(e) => setRows(e.target.value)}
          />

          <label htmlFor="cols">Columns</label>
          <input
            id="cols"
            type="number"
            min="1"
            max="100"
            value={cols}
            onChange={(e) => setCols(e.target.value)}
          />
        </div>

        <div className="controls-row">
          <label htmlFor="stroke-width">Border thickness (px)</label>
          <input
            id="stroke-width"
            type="number"
            min="1"
            max="20"
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(e.target.value)}
            placeholder="1"
          />

          <label htmlFor="stroke-color">Color</label>
          <input
            id="stroke-color"
            type="color"
            value={strokeColor}
            onChange={(e) => setStrokeColor(e.target.value)}
          />

          <button type="button" onClick={handleDraw}>
            Draw Grid
          </button>
        </div>
      </div>

      {drawnProps && (
        <Stage
          width={drawnProps.canvasWidth}
          height={drawnProps.canvasHeight}
          className="canvas-stage"
        >
          <Layer>
            {drawnProps.positions.map((pos, i) => (
              <RegularPolygon
                key={i}
                x={pos.x}
                y={pos.y}
                sides={6}
                radius={drawnProps.radius}
                rotation={drawnProps.rotation}
                fill="transparent"
                stroke={drawnProps.stroke}
                strokeWidth={drawnProps.strokeWidth}
              />
            ))}
          </Layer>
        </Stage>
      )}
    </main>
  )
}

export default App
