import { useRef, useState } from 'react'
import { Stage, Layer, RegularPolygon, Circle, Text } from 'react-konva'
import './App.css'

const BASE_PADDING = 10
const NUMBER_INSET = 3

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
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const yOff = c % 2 === 1 ? ryStep / 2 : 0
        raw.push({ x: c * cxStep, y: r * ryStep + yOff, row: r, col: c })
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
        raw.push({ x: c * cxStep + xOff, y: r * ryStep, row: r, col: c })
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
    positions: raw.map(p => ({ x: p.x + shiftX, y: p.y + shiftY, row: p.row, col: p.col })),
    canvasWidth:  maxX - minX + 2 * pad,
    canvasHeight: maxY - minY + 2 * pad,
  }
}

// Rotation: Konva's RegularPolygon defaults to point-up.
// Rotating 30° gives flat-top (side-up).
const ROTATION = { side: 30, point: 0 }

function hexPoints(cx, cy, radius, rotationDeg) {
  const points = []
  // Konva RegularPolygon starts at point-up for rotation 0.
  const base = ((rotationDeg - 90) * Math.PI) / 180
  for (let i = 0; i < 6; i++) {
    const angle = base + (i * Math.PI) / 3
    const x = cx + radius * Math.cos(angle)
    const y = cy + radius * Math.sin(angle)
    points.push(`${x.toFixed(3)},${y.toFixed(3)}`)
  }
  return points.join(' ')
}

function getHexCode(row, col) {
  return `${String(row).padStart(2, '0')}${String(col + 1).padStart(2, '0')}`
}

function App() {
  const stageRef = useRef(null)
  const [hexWidth,    setHexWidth]    = useState('')
  const [cols,        setCols]        = useState('1')
  const [rows,        setRows]        = useState('1')
  const [orientation, setOrientation] = useState('side')
  const [strokeColor, setStrokeColor] = useState('#000000')
  const [strokeWidth, setStrokeWidth] = useState('1')
  const [showCenterDot, setShowCenterDot] = useState(false)
  const [showNumbers, setShowNumbers] = useState(false)
  const [exportType, setExportType] = useState('png')
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
      orientation,
      stroke:      strokeColor,
      strokeWidth: sw,
      ...grid,
    })
  }

  const handleExportPng = () => {
    if (!stageRef.current) return

    // Konva exports only drawn pixels, so untouched areas stay transparent.
    const dataUrl = stageRef.current.toDataURL({ pixelRatio: 2 })
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = 'hex-grid.png'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleExportSvg = () => {
    if (!drawnProps) return

    const { canvasWidth, canvasHeight, positions, radius, rotation, stroke, strokeWidth, orientation } = drawnProps
    const halfH = orientation === 'side' ? (Math.sqrt(3) / 2) * radius : radius
    const dotRadius = Math.max(1.5, strokeWidth * 0.9)
    const numberFontSize = Math.max(10, Math.min(18, radius * 0.28))
    const polygons = positions
      .map((pos) => {
        const points = hexPoints(pos.x, pos.y, radius, rotation)
        return `<polygon points="${points}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" />`
      })
      .join('')
    const dots = showCenterDot
      ? positions
        .map((pos) => `<circle cx="${pos.x.toFixed(3)}" cy="${pos.y.toFixed(3)}" r="${dotRadius.toFixed(3)}" fill="${stroke}" />`)
        .join('')
      : ''
    const labels = showNumbers
      ? positions
        .map((pos) => {
          const code = getHexCode(pos.row, pos.col)
          const labelY = pos.y - halfH + NUMBER_INSET
          return `<text x="${pos.x.toFixed(3)}" y="${labelY.toFixed(3)}" text-anchor="middle" dominant-baseline="hanging" font-size="${numberFontSize.toFixed(2)}" font-family="Arial, sans-serif" fill="${stroke}">${code}</text>`
        })
        .join('')
      : ''

    const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}">${polygons}${dots}${labels}</svg>`
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = 'hex-grid.svg'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleExport = () => {
    if (exportType === 'svg') {
      handleExportSvg()
      return
    }
    handleExportPng()
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
          <label htmlFor="center-dot" className="checkbox-label">
            <input
              id="center-dot"
              type="checkbox"
              checked={showCenterDot}
              onChange={(e) => setShowCenterDot(e.target.checked)}
            />
            Center dot
          </label>

          <label htmlFor="show-numbers" className="checkbox-label">
            <input
              id="show-numbers"
              type="checkbox"
              checked={showNumbers}
              onChange={(e) => setShowNumbers(e.target.checked)}
            />
            Number hexes
          </label>
        </div>

        <div className="controls-row controls-actions">
          <button type="button" onClick={handleDraw}>
            Draw Grid
          </button>

          <div className="export-controls">
            <label htmlFor="export-type">Type</label>
            <select
              id="export-type"
              value={exportType}
              onChange={(e) => setExportType(e.target.value)}
            >
              <option value="png">PNG</option>
              <option value="svg">SVG</option>
            </select>

            <button type="button" onClick={handleExport} disabled={!drawnProps}>
              Export
            </button>
          </div>
        </div>
      </div>

      {drawnProps && (
        <Stage
          ref={stageRef}
          width={drawnProps.canvasWidth}
          height={drawnProps.canvasHeight}
          className="canvas-stage"
        >
          <Layer>
            {(() => {
              const halfW = drawnProps.orientation === 'side'
                ? drawnProps.radius
                : (Math.sqrt(3) / 2) * drawnProps.radius
              const halfH = drawnProps.orientation === 'side'
                ? (Math.sqrt(3) / 2) * drawnProps.radius
                : drawnProps.radius
              const numberFontSize = Math.max(10, Math.min(18, drawnProps.radius * 0.28))

              return (
                <>
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
            {showCenterDot && drawnProps.positions.map((pos, i) => (
              <Circle
                key={`dot-${i}`}
                x={pos.x}
                y={pos.y}
                radius={Math.max(1.5, drawnProps.strokeWidth * 0.9)}
                fill={drawnProps.stroke}
              />
            ))}
            {showNumbers && drawnProps.positions.map((pos, i) => (
              <Text
                key={`num-${i}`}
                x={pos.x - halfW}
                y={pos.y - halfH + NUMBER_INSET}
                width={halfW * 2}
                align="center"
                text={getHexCode(pos.row, pos.col)}
                fill={drawnProps.stroke}
                fontSize={numberFontSize}
                listening={false}
              />
            ))}
                </>
              )
            })()}
          </Layer>
        </Stage>
      )}
    </main>
  )
}

export default App
