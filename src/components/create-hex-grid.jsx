import { useEffect, useRef, useState } from 'react'
import { Stage, Layer, Group, RegularPolygon, Circle, Text } from 'react-konva'
import './create-hex-grid.css'

const BASE_PADDING = 10
const DEFAULT_NUMBER_OFFSET = { side: 3, point: 15 }
const GRID_DPI = 300
const UNIT_TO_PX = {
  px: 1,
  mm: GRID_DPI / 25.4,
  cm: GRID_DPI / 2.54,
  in: GRID_DPI,
}
const NUMBER_FONT_SIZE_OPTIONS = [
  { label: 'Auto', value: 'auto' },
  { label: '9 px', value: '9' },
  { label: '10 px', value: '10' },
  { label: '12 px', value: '12' },
  { label: '14 px', value: '14' },
  { label: '16 px', value: '16' },
  { label: '18 px', value: '18' },
  { label: '20 px', value: '20' },
  { label: '24 px', value: '24' },
]

// Hexes are positioned so their mathematical edges coincide with neighbours.
// Because Konva strokes are centred on the path, two adjacent hexes draw their
// stroke over exactly the same pixels -> the shared border always appears as
// strokeWidth, never 2xstrokeWidth.
function computeGrid(cols, rows, R, orientation, strokeWidth) {
  const pad = BASE_PADDING + strokeWidth / 2
  const raw = []

  if (orientation === 'side') {
    const cxStep = 1.5 * R
    const ryStep = Math.sqrt(3) * R
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const yOff = c % 2 === 1 ? ryStep / 2 : 0
        raw.push({ x: c * cxStep, y: r * ryStep + yOff, row: r, col: c })
      }
    }
  } else {
    const cxStep = Math.sqrt(3) * R
    const ryStep = 1.5 * R
    for (let r = 0; r < rows; r++) {
      const xOff = r % 2 === 1 ? cxStep / 2 : 0
      for (let c = 0; c < cols; c++) {
        raw.push({ x: c * cxStep + xOff, y: r * ryStep, row: r, col: c })
      }
    }
  }

  const halfW = orientation === 'side' ? R : (Math.sqrt(3) / 2) * R
  const halfH = orientation === 'side' ? (Math.sqrt(3) / 2) * R : R

  const xs = raw.map((p) => p.x)
  const ys = raw.map((p) => p.y)
  const minX = Math.min(...xs) - halfW
  const maxX = Math.max(...xs) + halfW
  const minY = Math.min(...ys) - halfH
  const maxY = Math.max(...ys) + halfH

  const shiftX = pad - minX
  const shiftY = pad - minY

  return {
    positions: raw.map((p) => ({ x: p.x + shiftX, y: p.y + shiftY, row: p.row, col: p.col })),
    canvasWidth: maxX - minX + 2 * pad,
    canvasHeight: maxY - minY + 2 * pad,
  }
}

function computeCountsForArea(targetWidthPx, targetHeightPx, R, orientation, strokeWidth) {
  const sqrt3 = Math.sqrt(3)
  const pad = BASE_PADDING + strokeWidth / 2
  const safeWidth = Math.max(0, targetWidthPx)
  const safeHeight = Math.max(0, targetHeightPx)

  if (orientation === 'side') {
    const cxStep = 1.5 * R
    const ryStep = sqrt3 * R
    const halfW = R
    const halfH = (sqrt3 / 2) * R

    const maxCols = Math.max(0, Math.floor((safeWidth - 2 * halfW - 2 * pad) / cxStep + 1))
    let best = { cols: 0, rows: 0, hexes: 0 }

    for (let c = 1; c <= maxCols; c++) {
      const extraHeight = c > 1 ? ryStep / 2 : 0
      const maxRows = Math.max(0, Math.floor((safeHeight - 2 * halfH - 2 * pad - extraHeight) / ryStep + 1))
      if (maxRows < 1) continue

      const hexes = c * maxRows
      if (hexes > best.hexes) {
        best = { cols: c, rows: maxRows, hexes }
      }
    }

    return { cols: best.cols, rows: best.rows }
  }

  const cxStep = sqrt3 * R
  const ryStep = 1.5 * R
  const halfW = (sqrt3 / 2) * R
  const halfH = R
  const maxRows = Math.max(0, Math.floor((safeHeight - 2 * halfH - 2 * pad) / ryStep + 1))
  let best = { cols: 0, rows: 0, hexes: 0 }

  for (let r = 1; r <= maxRows; r++) {
    const extraWidth = r > 1 ? cxStep / 2 : 0
    const maxCols = Math.max(0, Math.floor((safeWidth - 2 * halfW - 2 * pad - extraWidth) / cxStep + 1))
    if (maxCols < 1) continue

    const hexes = r * maxCols
    if (hexes > best.hexes) {
      best = { cols: maxCols, rows: r, hexes }
    }
  }

  return { cols: best.cols, rows: best.rows }
}

const ROTATION = { side: 30, point: 0 }

function hexPoints(cx, cy, radius, rotationDeg) {
  const points = []
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
  return `${encodeGridIndex(row)}${encodeGridIndex(col + 1)}`
}

function encodeGridIndex(value) {
  if (value < 100) {
    return String(value).padStart(2, '0')
  }

  const offset = value - 100
  let first = Math.floor(offset / 26)
  const second = offset % 26

  while (first >= 26) {
    first -= 26
  }

  return `${String.fromCharCode(65 + first)}${String.fromCharCode(65 + second)}`
}

function getNumberFontSize(radius, fontSizeSetting) {
  if (fontSizeSetting === 'auto') {
    return Math.max(10, Math.min(18, radius * 0.28))
  }

  return Math.max(1, parseFloat(fontSizeSetting) || 0)
}

function getNumberSideRotation(orientation, sideIndex) {
  const baseAngle = orientation === 'side' ? 0 : 30
  return baseAngle + (sideIndex % 6) * 60
}

function getNumberSideMidAngle(orientation, sideIndex) {
  return getNumberSideRotation(orientation, sideIndex) - 90
}

function getNumberAnchorOffset(orientation, sideIndex, radius, inset) {
  const apothem = (Math.sqrt(3) / 2) * radius
  const distance = Math.max(0, apothem - inset)
  const angle = (getNumberSideMidAngle(orientation, sideIndex) * Math.PI) / 180

  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance,
  }
}

function getNumberSideOptions(orientation) {
  if (orientation === 'side') {
    return [
      { label: 'Top side', value: '0' },
      { label: 'Upper-right side', value: '1' },
      { label: 'Lower-right side', value: '2' },
      { label: 'Bottom side', value: '3' },
      { label: 'Lower-left side', value: '4' },
      { label: 'Upper-left side', value: '5' },
    ]
  }

  return [
    { label: 'Upper-right side', value: '0' },
    { label: 'Right side', value: '1' },
    { label: 'Lower-right side', value: '2' },
    { label: 'Lower-left side', value: '3' },
    { label: 'Left side', value: '4' },
    { label: 'Upper-left side', value: '5' },
  ]
}

export default function CreateHexGrid() {
  const stageRef = useRef(null)
  const [hexWidth, setHexWidth] = useState('100')
  const [hexUnit, setHexUnit] = useState('px')
  const [gridMode, setGridMode] = useState('count')
  const [cols, setCols] = useState('10')
  const [rows, setRows] = useState('10')
  const [areaWidth, setAreaWidth] = useState('1000')
  const [areaHeight, setAreaHeight] = useState('1000')
  const [orientation, setOrientation] = useState('side')
  const [strokeColor, setStrokeColor] = useState('#000000')
  const [strokeWidth, setStrokeWidth] = useState('1')
  const [showCenterDot, setShowCenterDot] = useState(false)
  const [showNumbers, setShowNumbers] = useState(false)
  const [numberOffset, setNumberOffset] = useState(String(DEFAULT_NUMBER_OFFSET.side))
  const [numberOffsetTouched, setNumberOffsetTouched] = useState(false)
  const [numberFontSize, setNumberFontSize] = useState('auto')
  const [numberSide, setNumberSide] = useState('0')
  const [exportType, setExportType] = useState('png')
  const [drawnProps, setDrawnProps] = useState(null)

  useEffect(() => {
    if (!numberOffsetTouched) {
      setNumberOffset(String(DEFAULT_NUMBER_OFFSET[orientation]))
    }
  }, [orientation, numberOffsetTouched])

  useEffect(() => {
    if (hexUnit !== 'px' && exportType === 'svg') {
      setExportType('png')
    }
  }, [hexUnit, exportType])

  const canExportSvg = hexUnit === 'px'
  const hexCount = drawnProps?.positions.length ?? 0

  const handleDraw = () => {
    const unitFactor = UNIT_TO_PX[hexUnit] || 1
    const R = (parseFloat(hexWidth) * unitFactor) / 2
    const sw = Math.max(1, parseFloat(strokeWidth) || 1)
    if (!isFinite(R) || R <= 0) return

    let c = Math.max(1, parseInt(cols, 10) || 1)
    let r = Math.max(1, parseInt(rows, 10) || 1)

    if (gridMode === 'area') {
      const targetWidthPx = Math.max(1, (parseFloat(areaWidth) || 1) * unitFactor)
      const targetHeightPx = Math.max(1, (parseFloat(areaHeight) || 1) * unitFactor)
      const counts = computeCountsForArea(targetWidthPx, targetHeightPx, R, orientation, sw)
      c = counts.cols
      r = counts.rows

      if (c < 1 || r < 1) {
        setDrawnProps(null)
        return
      }
    }

    const grid = computeGrid(c, r, R, orientation, sw)
    setDrawnProps({
      radius: R,
      rotation: ROTATION[orientation],
      orientation,
      stroke: strokeColor,
      strokeWidth: sw,
      ...grid,
    })
  }

  const handleExportPng = () => {
    if (!stageRef.current) return

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

    const { canvasWidth, canvasHeight, positions, radius, rotation, stroke, strokeWidth: sw, orientation: o } = drawnProps
    const dotRadius = Math.max(1.5, sw * 0.9)
    const fontSize = getNumberFontSize(radius, numberFontSize)
    const textRotation = getNumberSideRotation(o, parseInt(numberSide, 10) || 0)
    const numberOffsetPx = Math.max(0, parseFloat(numberOffset) || 0)
    const numberSideIndex = parseInt(numberSide, 10) || 0
    const polygons = positions
      .map((pos) => {
        const points = hexPoints(pos.x, pos.y, radius, rotation)
        return `<polygon points="${points}" fill="none" stroke="${stroke}" stroke-width="${sw}" />`
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
          const anchor = getNumberAnchorOffset(o, numberSideIndex, radius, numberOffsetPx)
          const x = (pos.x + anchor.x).toFixed(3)
          const y = (pos.y + anchor.y).toFixed(3)
          return `<g transform="translate(${x} ${y}) rotate(${textRotation})"><text x="0" y="0" text-anchor="middle" dominant-baseline="middle" font-size="${fontSize.toFixed(2)}" font-family="Arial, sans-serif" fill="${stroke}">${code}</text></g>`
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
    <main className="create-hex-grid">
      <h1>Hex Grid Creator</h1>

      <div className="controls">
        <div className="controls-row">
          <label htmlFor="grid-mode">Type</label>
          <select
            id="grid-mode"
            value={gridMode}
            onChange={(e) => setGridMode(e.target.value)}
          >
            <option value="count">Rows and columns</option>
            <option value="area">Area width and height</option>
          </select>

          {gridMode === 'count' ? (
            <>
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
            </>
          ) : (
            <>
              <label htmlFor="area-width">Width ({hexUnit})</label>
              <input
                id="area-width"
                type="number"
                min="0.01"
                step="any"
                value={areaWidth}
                onChange={(e) => setAreaWidth(e.target.value)}
              />

              <label htmlFor="area-height">Height ({hexUnit})</label>
              <input
                id="area-height"
                type="number"
                min="0.01"
                step="any"
                value={areaHeight}
                onChange={(e) => setAreaHeight(e.target.value)}
              />
            </>
          )}
        </div>

        <div className="controls-row">
          <label htmlFor="hex-width">Hex size</label>
          <input
            id="hex-width"
            type="number"
            min="0.01"
            step="any"
            value={hexWidth}
            onChange={(e) => setHexWidth(e.target.value)}
            placeholder="e.g. 80"
          />

          <label htmlFor="hex-unit">Unit</label>
          <select
            id="hex-unit"
            value={hexUnit}
            onChange={(e) => setHexUnit(e.target.value)}
          >
            <option value="px">px</option>
            <option value="mm">mm</option>
            <option value="cm">cm</option>
            <option value="in">inches</option>
          </select>

          <label htmlFor="orientation">Orientation</label>
          <select
            id="orientation"
            value={orientation}
            onChange={(e) => setOrientation(e.target.value)}
          >
            <option value="side">Side up</option>
            <option value="point">Point up</option>
          </select>
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
        </div>

        <div className="controls-row">
          <label htmlFor="show-numbers" className="checkbox-label">
            <input
              id="show-numbers"
              type="checkbox"
              checked={showNumbers}
              onChange={(e) => setShowNumbers(e.target.checked)}
            />
            Number hexes
          </label>

          <label htmlFor="number-offset">Inset (px)</label>
          <input
            id="number-offset"
            type="number"
            min="0"
            max="100"
            value={numberOffset}
            onChange={(e) => {
              setNumberOffsetTouched(true)
              setNumberOffset(e.target.value)
            }}
            placeholder={String(DEFAULT_NUMBER_OFFSET[orientation])}
          />

          <label htmlFor="number-font-size">Font size</label>
          <select
            id="number-font-size"
            value={numberFontSize}
            onChange={(e) => setNumberFontSize(e.target.value)}
          >
            {NUMBER_FONT_SIZE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <label htmlFor="number-side">Text side</label>
          <select
            id="number-side"
            value={numberSide}
            onChange={(e) => setNumberSide(e.target.value)}
          >
            {getNumberSideOptions(orientation).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="controls-row controls-actions">
          <button type="button" onClick={handleDraw}>
            Draw Grid
          </button>

          <span className="hex-count">Hexes: {hexCount}</span>

          <div className="export-controls">
            <label htmlFor="export-type">Type</label>
            <select
              id="export-type"
              value={exportType}
              onChange={(e) => setExportType(e.target.value)}
            >
              <option value="png">PNG</option>
              <option value="svg" disabled={!canExportSvg}>SVG</option>
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
              const fontSize = getNumberFontSize(drawnProps.radius, numberFontSize)
              const textRotation = getNumberSideRotation(drawnProps.orientation, parseInt(numberSide, 10) || 0)
              const numberOffsetPx = Math.max(0, parseFloat(numberOffset) || 0)
              const numberSideIndex = parseInt(numberSide, 10) || 0

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
                  {showNumbers && drawnProps.positions.map((pos, i) => {
                    const anchor = getNumberAnchorOffset(drawnProps.orientation, numberSideIndex, drawnProps.radius, numberOffsetPx)
                    return (
                      <Group
                        key={`num-${i}`}
                        x={pos.x + anchor.x}
                        y={pos.y + anchor.y}
                        rotation={textRotation}
                        listening={false}
                      >
                        <Text
                          x={-halfW}
                          y={-fontSize / 2}
                          width={halfW * 2}
                          align="center"
                          text={getHexCode(pos.row, pos.col)}
                          fill={drawnProps.stroke}
                          fontSize={fontSize}
                          listening={false}
                        />
                      </Group>
                    )
                  })}
                </>
              )
            })()}
          </Layer>
        </Stage>
      )}
    </main>
  )
}
