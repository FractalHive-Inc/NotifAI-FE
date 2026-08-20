import { useCallback, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { FileText, Loader2, Send, Trash2, UploadCloud } from 'lucide-react'
import { toast } from 'sonner'
import { INGESTION_API_KEY } from '@/config/env'
import {
  countPages,
  FILE_INPUT_ACCEPT,
  detectDocType,
  type PageCountResult,
} from '@/features/ingestion/lib/page-count'
import { Button } from '@/shared/components/ui/button'
import { Card } from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { useDocumentUpload } from '@/shared/hooks/useDocumentUpload'
import { formatFileSize } from '@/shared/lib/formatters'

/**
 * A faint dot grid under the drop surface. It reads as texture rather than
 * decoration at this opacity, and gives the empty state something to be — an
 * expanse — instead of a flat panel with a border drawn round it.
 */
const DROP_SURFACE_TEXTURE = {
  backgroundImage:
    'radial-gradient(circle at 50% 0%, rgba(16,31,69,0.06), transparent 65%), radial-gradient(rgba(16,31,69,0.10) 1px, transparent 1px)',
  backgroundSize: '100% 100%, 22px 22px',
}

export default function DocumentUploadPage() {
  const upload = useDocumentUpload()
  const inputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState<PageCountResult | null>(null)
  const [isCounting, setIsCounting] = useState(false)
  // Only used when the file could not be counted — see PageCountResult.
  const [manualPages, setManualPages] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  /**
   * Reading a file is async, and a user who picks a second document before the
   * first has finished counting would otherwise see the first file's page count
   * land on the second file. Only the newest selection is allowed to publish.
   */
  const selectionId = useRef(0)

  const resetSelection = useCallback(() => {
    selectionId.current += 1
    setFile(null)
    setPageCount(null)
    setIsCounting(false)
    setManualPages('')
    upload.reset()
    if (inputRef.current) inputRef.current.value = ''
  }, [upload])

  const handleFile = useCallback(
    async (picked: File) => {
      if (!detectDocType(picked)) {
        toast.error('Unsupported file type. Upload a PDF or DOCX.')
        return
      }

      const id = ++selectionId.current
      setFile(picked)
      setPageCount(null)
      setManualPages('')
      setIsCounting(true)
      upload.reset()

      const result = await countPages(picked)
      if (selectionId.current !== id) return

      setPageCount(result)
      setIsCounting(false)
    },
    [upload],
  )

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    const dropped = event.dataTransfer.files?.[0]
    if (dropped) void handleFile(dropped)
  }

  const detectedPages = pageCount?.status === 'detected' ? pageCount.pages : null
  const parsedManualPages = Number.parseInt(manualPages, 10)
  const effectivePages =
    detectedPages ??
    (Number.isFinite(parsedManualPages) && parsedManualPages > 0 ? parsedManualPages : null)

  const isConfigured = Boolean(INGESTION_API_KEY)
  const canSend = Boolean(file) && effectivePages !== null && !isCounting && isConfigured

  const fileExtension = file ? (file.name.split('.').pop()?.toUpperCase() ?? '') : ''

  const handleSend = async () => {
    if (!file || effectivePages === null) return
    try {
      await upload.mutateAsync({ file, pages: effectivePages })
      toast.success(`${file.name} sent to ingestion`)
      resetSelection()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed')
    }
  }

  return (
    <div className="w-full max-w-3xl">
      <h2 className="text-2xl font-bold tracking-tight text-[#043463] sm:text-3xl">
        Upload Document
      </h2>

      {!isConfigured && (
        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No ingestion API key configured. Set{' '}
          <code className="font-mono">VITE_INGESTION_API_KEY</code> in{' '}
          <code className="font-mono">.env</code> and restart the dev server.
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={FILE_INPUT_ACCEPT}
        className="hidden"
        onChange={(event) => {
          const picked = event.target.files?.[0]
          if (picked) void handleFile(picked)
        }}
      />

      <Card className="mt-6 gap-0 overflow-hidden rounded-2xl border-[#e4e7ec] p-2 shadow-[0_1px_2px_rgba(16,31,69,0.04),0_8px_24px_-12px_rgba(16,31,69,0.12)]">
        <AnimatePresence mode="wait" initial={false}>
          {!file ? (
            <motion.div
              key="dropzone"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              role="button"
              tabIndex={0}
              aria-label="Choose a document to upload"
              onClick={() => inputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  inputRef.current?.click()
                }
              }}
              onDragOver={(event) => {
                event.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              style={DROP_SURFACE_TEXTURE}
              /* `*:pointer-events-none`: `dragleave` bubbles, so crossing onto
                 the icon or the labels would otherwise read as leaving the zone
                 and flicker the drag state. The children are decorative, so
                 taking them out of hit-testing keeps every drag event on the
                 zone itself. */
              className={`group flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-20 text-center outline-none transition-all duration-300 *:pointer-events-none ${
                isDragging
                  ? 'border-[#101f45] bg-[#eef3ff]'
                  : 'border-[#c9d3e4] bg-[#fbfcfe] hover:border-[#101f45]/60 hover:bg-[#f6f8fd] focus-visible:border-[#101f45] focus-visible:ring-2 focus-visible:ring-[#101f45]/20'
              }`}
            >
              <div className="relative">
                {/* Halo: sits behind the tile and blooms on drag, so the surface
                    itself reacts rather than just its border. */}
                <div
                  className={`absolute -inset-4 rounded-full bg-[#101f45] blur-2xl transition-opacity duration-300 ${
                    isDragging ? 'opacity-[0.14]' : 'opacity-0 group-hover:opacity-[0.07]'
                  }`}
                />
                <div
                  className={`relative rounded-2xl border border-[#101f45]/10 bg-white p-4 shadow-sm transition-transform duration-300 ${
                    isDragging ? 'scale-110' : 'group-hover:scale-105'
                  }`}
                >
                  <UploadCloud
                    className={`h-7 w-7 text-[#101f45] transition-transform duration-300 ${
                      isDragging ? '-translate-y-0.5' : ''
                    }`}
                  />
                </div>
              </div>

              <p className="mt-6 text-base font-semibold text-[#0f172a]">
                {isDragging ? 'Release to attach' : 'Drop an invoice here'}
              </p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                or <span className="font-medium text-[#101f45] underline-offset-4">browse</span>{' '}
                your files
              </p>

              <div className="mt-7 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
                <span>PDF</span>
                <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                <span>DOCX</span>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="selected"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="p-4 sm:p-5"
            >
              <div className="flex items-start gap-4">
                <div className="relative shrink-0">
                  <div className="rounded-xl border border-[#101f45]/10 bg-[#f4f7ff] p-3">
                    <FileText className="h-6 w-6 text-[#101f45]" />
                  </div>
                  {fileExtension && (
                    <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-[#101f45] px-1.5 py-px text-[9px] font-bold tracking-wide text-white">
                      {fileExtension}
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="truncate font-semibold text-[#0f172a]" title={file.name}>
                    {file.name}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                      {formatFileSize(file.size)}
                    </span>
                    {isCounting ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Reading pages
                      </span>
                    ) : (
                      detectedPages !== null && (
                        <span className="rounded-full bg-[#e8efff] px-2.5 py-0.5 text-xs font-semibold text-[#101f45]">
                          {detectedPages} {detectedPages === 1 ? 'page' : 'pages'}
                        </span>
                      )
                    )}
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600"
                  onClick={resetSelection}
                  disabled={upload.isPending}
                  title="Remove file"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {pageCount?.status === 'unknown' && (
                <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3.5">
                  <p className="text-sm text-amber-800">{pageCount.reason}</p>
                  <div className="mt-3 flex items-center gap-2.5">
                    <Label htmlFor="manual-pages" className="text-xs font-semibold text-amber-900">
                      Pages
                    </Label>
                    <Input
                      id="manual-pages"
                      type="number"
                      min={1}
                      value={manualPages}
                      onChange={(event) => setManualPages(event.target.value)}
                      className="h-9 w-24 border-amber-200 bg-white focus-visible:ring-amber-400/30"
                      placeholder="e.g. 2"
                      autoFocus
                    />
                  </div>
                </div>
              )}

              {upload.isError && (
                <div className="mt-5 rounded-xl border border-red-200 bg-red-50/70 px-4 py-3.5 text-sm text-red-700">
                  {upload.error.message}
                </div>
              )}

              <div className="mt-6 flex items-center justify-between gap-3 border-t border-[#eef1f6] pt-5">
                <Button
                  variant="ghost"
                  onClick={() => inputRef.current?.click()}
                  disabled={upload.isPending}
                  className="text-muted-foreground hover:text-[#101f45]"
                >
                  Choose a different file
                </Button>
                <Button
                  onClick={handleSend}
                  disabled={!canSend || upload.isPending}
                  className="bg-[#101f45] text-white shadow-sm transition-all hover:bg-[#142958] hover:shadow-md disabled:opacity-40 disabled:shadow-none"
                >
                  {upload.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {upload.isPending ? 'Sending…' : 'Send to ingestion'}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </div>
  )
}
