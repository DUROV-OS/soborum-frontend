import { Block } from '../types'

/** Направленный граф блоков одного производства: узлы расставлены по столбцам
 * `sequence` (порядок), стрелки — зависимости `depends_on_ids`. Вручную на
 * SVG, без внешней библиотеки графов — по образцу
 * `frontend/src/agents/components/AgentConstellation.tsx`. */

const NODE_WIDTH = 168
const NODE_HEIGHT = 56
const COLUMN_GAP = 96
const ROW_GAP = 24
const PADDING = 32

function columnsOf(blocks: Block[]): Block[][] {
  const bySequence = new Map<number, Block[]>()
  for (const block of blocks) {
    const list = bySequence.get(block.sequence) ?? []
    list.push(block)
    bySequence.set(block.sequence, list)
  }
  return Array.from(bySequence.keys())
    .sort((a, b) => a - b)
    .map((seq) => bySequence.get(seq)!)
}

export function BlockGraph({ blocks, onSelect }: { blocks: Block[]; onSelect?: (block: Block) => void }) {
  const columns = columnsOf(blocks)
  const maxRows = Math.max(1, ...columns.map((c) => c.length))
  const width = PADDING * 2 + columns.length * NODE_WIDTH + Math.max(0, columns.length - 1) * COLUMN_GAP
  const height = PADDING * 2 + maxRows * NODE_HEIGHT + Math.max(0, maxRows - 1) * ROW_GAP

  const positionById = new Map<number, { x: number; y: number }>()
  columns.forEach((column, colIndex) => {
    const x = PADDING + colIndex * (NODE_WIDTH + COLUMN_GAP)
    const colHeight = column.length * NODE_HEIGHT + Math.max(0, column.length - 1) * ROW_GAP
    const startY = PADDING + (height - PADDING * 2 - colHeight) / 2
    column.forEach((block, rowIndex) => {
      const y = startY + rowIndex * (NODE_HEIGHT + ROW_GAP)
      positionById.set(block.id, { x, y })
    })
  })

  if (blocks.length === 0) {
    return <p className="text-[13px] text-muted">Блоков пока нет — добавьте первый.</p>
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border bg-surface">
      <svg
        viewBox={`0 0 ${Math.max(width, 320)} ${Math.max(height, 160)}`}
        role="img"
        aria-label="Граф зависимостей блоков производства"
        className="h-auto min-w-[480px] w-full"
      >
        <g stroke="rgb(43 105 80 / 0.35)" strokeWidth="1.5" fill="none">
          {blocks.flatMap((block) =>
            block.depends_on_ids
              .map((depId) => {
                const from = positionById.get(depId)
                const to = positionById.get(block.id)
                if (!from || !to) return null
                const x1 = from.x + NODE_WIDTH
                const y1 = from.y + NODE_HEIGHT / 2
                const x2 = to.x
                const y2 = to.y + NODE_HEIGHT / 2
                const midX = (x1 + x2) / 2
                return (
                  <path
                    key={`edge-${depId}-${block.id}`}
                    d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                    markerEnd="url(#block-graph-arrow)"
                  />
                )
              })
              .filter(Boolean)
          )}
        </g>
        <defs>
          <marker id="block-graph-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="rgb(43 105 80 / 0.6)" />
          </marker>
        </defs>
        {blocks.map((block) => {
          const point = positionById.get(block.id)
          if (!point) return null
          const blocked = block.depends_on_ids.length > 0
          return (
            <g
              key={block.id}
              transform={`translate(${point.x} ${point.y})`}
              className={onSelect ? 'cursor-pointer' : undefined}
              onClick={() => onSelect?.(block)}
            >
              <rect
                width={NODE_WIDTH}
                height={NODE_HEIGHT}
                rx={10}
                fill="white"
                stroke={blocked ? 'rgb(181 138 63)' : 'rgb(43 105 80)'}
                strokeWidth={1.5}
              />
              <text
                x={12}
                y={22}
                fontSize={13}
                fontWeight={500}
                fill="rgb(28 43 43)"
                fontFamily="Rubik, Arial, sans-serif"
              >
                {block.name.length > 18 ? `${block.name.slice(0, 17)}…` : block.name}
              </text>
              <text x={12} y={40} fontSize={11} fill="rgb(100 115 117)" fontFamily="Rubik, Arial, sans-serif">
                {blocked ? 'ждёт зависимостей' : 'готов к старту'}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
