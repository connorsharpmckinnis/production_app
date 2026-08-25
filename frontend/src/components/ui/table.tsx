import * as React from "react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"

const MIN_COLUMN_WIDTH = 72
const MAX_INITIAL_COLUMN_WIDTH = 320
const RESIZE_STEP = 16

type TableResizeContextValue = {
  resizeColumn: (columnIndex: number, width: number) => void
  resetColumn: (columnIndex: number) => void
  startResize: (
    event: React.PointerEvent<HTMLDivElement>,
    columnIndex: number,
  ) => void
}

const TableResizeContext = React.createContext<TableResizeContextValue | null>(
  null,
)

type TableTooltip = {
  left: number
  top: number
  value: string
}

function getOverflowingElement(cell: HTMLTableCellElement) {
  const candidates = [cell, ...cell.querySelectorAll<HTMLElement>("*")]
  return candidates.find(
    (element) =>
      element.scrollWidth > element.clientWidth + 1 &&
      element.clientWidth > 0,
  )
}

function getTooltipValue(
  cell: HTMLTableCellElement,
  overflowingElement: HTMLElement,
) {
  const explicitValue =
    overflowingElement.dataset.tableTooltip ??
    cell.dataset.tableTooltip
  if (explicitValue) return explicitValue

  const text =
    overflowingElement.innerText.trim() || cell.innerText.trim()
  return text.replace(/\s+/g, " ")
}

function Table({
  className,
  children,
  storageKey,
  style,
  ...props
}: React.ComponentProps<"table"> & {
  storageKey?: string
}) {
  const tableRef = React.useRef<HTMLTableElement>(null)
  const initialWidthsRef = React.useRef<number[]>([])
  const tooltipTimerRef = React.useRef<number | null>(null)
  const [columnWidths, setColumnWidths] = React.useState<number[]>([])
  const [tooltip, setTooltip] = React.useState<TableTooltip | null>(null)

  const localStorageKey = storageKey
    ? `production-app:table-widths:${storageKey}`
    : null

  React.useLayoutEffect(() => {
    const table = tableRef.current
    const headerCells = table?.querySelectorAll<HTMLTableCellElement>(
      "thead tr:last-child > th",
    )
    if (!table || !headerCells?.length) return

    const measuredWidths = Array.from(headerCells, (cell) =>
      Math.min(
        MAX_INITIAL_COLUMN_WIDTH,
        Math.max(MIN_COLUMN_WIDTH, Math.round(cell.getBoundingClientRect().width)),
      ),
    )
    initialWidthsRef.current = measuredWidths

    if (localStorageKey) {
      try {
        const savedWidths = JSON.parse(
          window.localStorage.getItem(localStorageKey) ?? "[]",
        )
        if (
          Array.isArray(savedWidths) &&
          savedWidths.length === measuredWidths.length &&
          savedWidths.every(
            (width) => typeof width === "number" && width >= MIN_COLUMN_WIDTH,
          )
        ) {
          setColumnWidths(savedWidths)
          return
        }
      } catch {
        // Invalid browser storage should not stop the table from rendering.
      }
    }

    setColumnWidths(measuredWidths)
  }, [localStorageKey])

  React.useEffect(() => {
    if (!localStorageKey || columnWidths.length === 0) return
    try {
      window.localStorage.setItem(
        localStorageKey,
        JSON.stringify(columnWidths),
      )
    } catch {
      // Resizing still works when browser storage is unavailable.
    }
  }, [columnWidths, localStorageKey])

  React.useEffect(
    () => () => {
      if (tooltipTimerRef.current != null) {
        window.clearTimeout(tooltipTimerRef.current)
      }
    },
    [],
  )

  const resizeColumn = React.useCallback(
    (columnIndex: number, width: number) => {
      setColumnWidths((currentWidths) => {
        if (columnIndex < 0 || columnIndex >= currentWidths.length) {
          return currentWidths
        }
        const nextWidths = [...currentWidths]
        nextWidths[columnIndex] = Math.max(MIN_COLUMN_WIDTH, Math.round(width))
        return nextWidths
      })
    },
    [],
  )

  const resetColumn = React.useCallback((columnIndex: number) => {
    const initialWidth = initialWidthsRef.current[columnIndex]
    if (initialWidth != null) resizeColumn(columnIndex, initialWidth)
  }, [resizeColumn])

  const startResize = React.useCallback(
    (
      event: React.PointerEvent<HTMLDivElement>,
      columnIndex: number,
    ) => {
      event.preventDefault()
      event.stopPropagation()

      const startX = event.clientX
      const startWidth = columnWidths[columnIndex]
      if (startWidth == null) return

      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"

      function handlePointerMove(pointerEvent: PointerEvent) {
        resizeColumn(columnIndex, startWidth + pointerEvent.clientX - startX)
      }

      function handlePointerUp() {
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
        window.removeEventListener("pointermove", handlePointerMove)
        window.removeEventListener("pointerup", handlePointerUp)
      }

      window.addEventListener("pointermove", handlePointerMove)
      window.addEventListener("pointerup", handlePointerUp)
    },
    [columnWidths, resizeColumn],
  )

  const resizeContext = React.useMemo(
    () => ({ resizeColumn, resetColumn, startResize }),
    [resetColumn, resizeColumn, startResize],
  )

  function clearTooltipTimer() {
    if (tooltipTimerRef.current != null) {
      window.clearTimeout(tooltipTimerRef.current)
      tooltipTimerRef.current = null
    }
  }

  function handleMouseOver(event: React.MouseEvent<HTMLTableElement>) {
    const target = event.target as HTMLElement
    const cell = target.closest<HTMLTableCellElement>("th, td")
    if (!cell || !tableRef.current?.contains(cell)) return

    const relatedTarget = event.relatedTarget as Node | null
    if (relatedTarget && cell.contains(relatedTarget)) return

    clearTooltipTimer()
    setTooltip(null)
    tooltipTimerRef.current = window.setTimeout(() => {
      const overflowingElement = getOverflowingElement(cell)
      if (!overflowingElement) return

      const value = getTooltipValue(cell, overflowingElement)
      if (!value) return

      const rect = cell.getBoundingClientRect()
      const horizontalMargin = Math.min(200, window.innerWidth / 2)
      setTooltip({
        left: Math.min(
          Math.max(rect.left + rect.width / 2, horizontalMargin),
          window.innerWidth - horizontalMargin,
        ),
        top: rect.bottom + 6,
        value,
      })
    }, 500)
  }

  function handleMouseOut(event: React.MouseEvent<HTMLTableElement>) {
    const target = event.target as HTMLElement
    const cell = target.closest<HTMLTableCellElement>("th, td")
    const relatedTarget = event.relatedTarget as Node | null
    if (cell && relatedTarget && cell.contains(relatedTarget)) return
    clearTooltipTimer()
    setTooltip(null)
  }

  const tableWidth = columnWidths.reduce((total, width) => total + width, 0)

  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        ref={tableRef}
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        style={{
          ...(columnWidths.length > 0
            ? {
                tableLayout: "fixed",
                width: `max(100%, ${tableWidth}px)`,
              }
            : {}),
          ...style,
        }}
        onMouseOver={handleMouseOver}
        onMouseOut={handleMouseOut}
        {...props}
      >
        {columnWidths.length > 0 && (
          <colgroup>
            {columnWidths.map((width, index) => (
              <col key={index} style={{ width }} />
            ))}
          </colgroup>
        )}
        <TableResizeContext.Provider value={resizeContext}>
          {children}
        </TableResizeContext.Provider>
      </table>
      {tooltip &&
        createPortal(
          <div
            role="tooltip"
            className="pointer-events-none fixed z-50 max-w-[min(24rem,calc(100vw-1rem))] -translate-x-1/2 rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs whitespace-normal text-popover-foreground"
            style={{ left: tooltip.left, top: tooltip.top }}
          >
            {tooltip.value}
          </div>,
          document.body,
        )}
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("bg-muted/50 [&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className,
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className,
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  const resizeContext = React.useContext(TableResizeContext)

  function getColumnIndex(element: HTMLDivElement) {
    return element.parentElement instanceof HTMLTableCellElement
      ? element.parentElement.cellIndex
      : -1
  }

  return (
    <th
      data-slot="table-head"
      className={cn(
        "relative h-10 overflow-hidden px-4 text-left align-middle font-medium text-ellipsis whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className,
      )}
      {...props}
    >
      {props.children}
      {resizeContext && (
        <div
          data-slot="table-resizer"
          role="separator"
          aria-label="Resize column"
          aria-orientation="vertical"
          tabIndex={0}
          className="absolute inset-y-0 right-0 z-20 w-2 cursor-col-resize touch-none select-none after:absolute after:inset-y-2 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-border hover:after:bg-ring focus-visible:outline-none focus-visible:after:w-0.5 focus-visible:after:bg-ring [[data-slot=table-header]_tr:not(:last-child)_&]:hidden"
          onPointerDown={(event) =>
            resizeContext.startResize(event, getColumnIndex(event.currentTarget))
          }
          onDoubleClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            resizeContext.resetColumn(getColumnIndex(event.currentTarget))
          }}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
            event.preventDefault()
            event.stopPropagation()
            const columnIndex = getColumnIndex(event.currentTarget)
            const cellWidth =
              event.currentTarget.parentElement?.getBoundingClientRect().width
            if (cellWidth == null) return
            resizeContext.resizeColumn(
              columnIndex,
              cellWidth + (event.key === "ArrowRight" ? RESIZE_STEP : -RESIZE_STEP),
            )
          }}
        />
      )}
    </th>
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "overflow-hidden px-4 py-3 align-middle text-ellipsis whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className,
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
