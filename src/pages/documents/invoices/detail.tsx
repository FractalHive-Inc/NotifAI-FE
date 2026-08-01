import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertTriangle, CheckCircle2, Download, Plus, Save, Trash2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card/card'
import { Button } from '@/shared/components/ui/button/button'
import { Input } from '@/shared/components/ui/input/input'
import { Label } from '@/shared/components/ui/label/label'
import { Badge } from '@/shared/components/ui/badge/badge'
import { Alert, AlertDescription } from '@/shared/components/ui/alert/alert'
import { Separator } from '@/shared/components/ui/separator/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table/table'
import { Skeleton } from '@/shared/components/ui/skeleton/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip/tooltip'
import UncategoriseInvoiceDialog from '@/components/invoices/UncategoriseInvoiceDialog'
import { useInvoice, useUncategoriseInvoice, useUpdateInvoice } from '@/shared/hooks/useInvoices'
import { API_URL } from '@/config/env'

const invoiceSchema = z.object({
  vendor_name: z.string().max(255).optional().nullable(),
  vendor_gst_tin: z.string().max(50).optional().nullable(),
  vendor_address: z.string().optional().nullable(),
  invoice_number: z.string().min(1, 'Invoice number is required').max(100),
  invoice_date: z.date(),
  invoice_due_date: z.date(),
  invoice_currency: z.string().length(3),
  invoice_subtotal: z.number().min(0),
  total_tax_amount: z.number().min(0),
  total_discount_amount: z.number().min(0).optional().nullable(),
  shipping_charges: z.number().min(0).optional().nullable(),
  other_charges: z.number().min(0).optional().nullable(),
  payment_terms: z.string().optional().nullable(),
  line_items: z
    .array(
      z.object({
        line_number: z.number(),
        description: z.string().min(1, 'Description required'),
        quantity: z.number().min(0.001, 'Quantity must be > 0'),
        unit_price: z.number().min(0),
        tax_amount: z.number().min(0).optional().nullable(),
      }),
    )
    .min(1, 'At least one line item required'),
})

type InvoiceFormData = z.infer<typeof invoiceSchema>

function toDateInputValue(date: Date | null | undefined) {
  if (!date) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export default function InvoiceDetailPage() {
  const navigate = useNavigate()
  const { id = '' } = useParams<{ id: string }>()
  const [openUncategorise, setOpenUncategorise] = useState(false)

  const { data: invoice, isLoading } = useInvoice(id)
  const updateMutation = useUpdateInvoice()
  const uncategoriseMutation = useUncategoriseInvoice()

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { isDirty },
  } = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      vendor_name: '',
      vendor_gst_tin: '',
      vendor_address: '',
      invoice_number: '',
      invoice_date: new Date(),
      invoice_due_date: new Date(),
      invoice_currency: 'INR',
      invoice_subtotal: 0,
      total_tax_amount: 0,
      total_discount_amount: 0,
      shipping_charges: 0,
      other_charges: 0,
      payment_terms: '',
      line_items: [],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'line_items',
  })

  const watchedFields = watch()
  const [calculatedTotal, setCalculatedTotal] = useState(0)
  const [pdfUrl, setPdfUrl] = useState('')

  useEffect(() => {
    if (invoice) {
      const subtotal = Number(watchedFields.invoice_subtotal) || 0
      const tax = Number(watchedFields.total_tax_amount) || 0
      const discount = Number(watchedFields.total_discount_amount) || 0
      const shipping = Number(watchedFields.shipping_charges) || 0
      const other = Number(watchedFields.other_charges) || 0
      const total = subtotal + tax + shipping + other - discount
      setCalculatedTotal(isNaN(total) ? 0 : total)
    }
  }, [watchedFields, invoice])

  useEffect(() => {
    if (invoice) {
      setValue('vendor_name', invoice.vendor_name || '', { shouldDirty: false })
      setValue('vendor_gst_tin', invoice.vendor_gst_tin || '', { shouldDirty: false })
      setValue('vendor_address', invoice.vendor_address || '', { shouldDirty: false })
      setValue('invoice_number', invoice.invoice_number || '', { shouldDirty: false })
      setValue('invoice_date', invoice.invoice_date ? new Date(invoice.invoice_date) : new Date(), {
        shouldDirty: false,
      })
      setValue(
        'invoice_due_date',
        invoice.invoice_due_date ? new Date(invoice.invoice_due_date) : new Date(),
        { shouldDirty: false },
      )
      setValue('invoice_currency', invoice.invoice_currency || 'INR', {
        shouldDirty: false,
      })
      setValue('invoice_subtotal', invoice.invoice_subtotal || 0, { shouldDirty: false })
      setValue('total_tax_amount', invoice.total_tax_amount || 0, { shouldDirty: false })
      setValue('total_discount_amount', invoice.total_discount_amount || 0, {
        shouldDirty: false,
      })
      setValue('shipping_charges', invoice.shipping_charges || 0, { shouldDirty: false })
      setValue('other_charges', invoice.other_charges || 0, { shouldDirty: false })
      setValue('payment_terms', invoice.payment_terms || '', { shouldDirty: false })
      setValue('line_items', invoice.line_items || [], { shouldDirty: false })
    }
  }, [invoice, setValue])

  useEffect(() => {
    if (invoice?.document_id) {
      const token = localStorage.getItem('token')
      if (token) {
        setPdfUrl(
          `${API_URL}/api/documents/${invoice.document_id}/download?token=${encodeURIComponent(token)}`,
        )
      }
    }
  }, [invoice?.document_id])

  if (isLoading || !invoice) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[620px] w-full rounded-xl" />
      </div>
    )
  }

  const calculateLineAmount = (index: number): number => {
    try {
      const quantity = watch(`line_items.${index}.quantity`)
      const unitPrice = watch(`line_items.${index}.unit_price`)
      const qty = typeof quantity === 'number' ? quantity : parseFloat(String(quantity || 0)) || 0
      const price =
        typeof unitPrice === 'number' ? unitPrice : parseFloat(String(unitPrice || 0)) || 0
      const result = qty * price
      return isNaN(result) || !isFinite(result) ? 0 : result
    } catch {
      return 0
    }
  }

  const calculateLineTotal = (index: number): number => {
    try {
      const lineAmount = calculateLineAmount(index)
      const taxAmount = watch(`line_items.${index}.tax_amount`)
      const tax =
        typeof taxAmount === 'number' ? taxAmount : parseFloat(String(taxAmount || 0)) || 0
      const total = lineAmount + tax
      return isNaN(total) || !isFinite(total) ? 0 : total
    } catch {
      return 0
    }
  }

  const handleAddLineItem = () => {
    append({
      line_number: fields.length + 1,
      description: '',
      quantity: 0,
      unit_price: 0,
      tax_amount: 0,
    })
  }

  const onSubmit = async (data: InvoiceFormData) => {
    try {
      const lineItems = data.line_items.map((item) => {
        const lineAmount = item.quantity * item.unit_price
        const taxAmount = item.tax_amount ?? null
        const lineTotal = lineAmount + (taxAmount || 0)
        return {
          ...item,
          tax_amount: taxAmount,
          line_amount: lineAmount,
          line_total: lineTotal,
        }
      })

      await updateMutation.mutateAsync({
        id,
        data: {
          ...data,
          invoice_date: data.invoice_date.toISOString(),
          invoice_due_date: data.invoice_due_date.toISOString(),
          line_items: lineItems,
        },
      })
      toast.success('Invoice saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update invoice')
    }
  }

  const handleDownload = () => {
    if (!invoice?.document_id) return
    try {
      const token = localStorage.getItem('token')
      const url = `${API_URL}/api/documents/${invoice.document_id}/download?token=${encodeURIComponent(token || '')}&download=true`
      const link = window.document.createElement('a')
      link.href = url
      link.download = `${invoice.invoice_number || 'invoice'}.pdf`
      window.document.body.appendChild(link)
      link.click()
      window.document.body.removeChild(link)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to download')
    }
  }

  const handleConfirmUncategorise = async () => {
    try {
      await uncategoriseMutation.mutateAsync(id)
      setOpenUncategorise(false)
      toast.success('Invoice uncategorised')
      navigate('/documents/all')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to uncategorise invoice')
    }
  }

  return (
    <>
      <div className="grid h-[calc(100vh-72px)] grid-cols-1 md:grid-cols-2">
        <div className="sticky top-[72px] h-[calc(100vh-72px)] overflow-hidden border-r border-border">
          <Card className="h-full rounded-none border-0 shadow-none">
            <CardContent className="flex h-full flex-col">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-xl font-semibold">Invoice Document</h2>
                <Button size="sm" variant="outline" onClick={handleDownload}>
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              </div>
              {pdfUrl ? (
                <iframe
                  src={pdfUrl}
                  className="h-full w-full rounded-md border border-border"
                  title="Invoice Document"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-md border border-dashed border-border bg-muted/20">
                  <p className="text-sm text-muted-foreground">Loading document...</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="h-[calc(100vh-72px)] overflow-y-auto p-4 md:p-6">
          {invoice.has_duplicate_warning && (
            <Alert className="mb-4 border-yellow-300 bg-yellow-50 text-yellow-800">
              <AlertDescription className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Warning: Duplicate invoice number detected in the system
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Card className="rounded-xl border-[#e4e7ec] shadow-none">
              <CardContent className="flex items-center justify-between">
                <h3 className="text-4xl font-semibold">{invoice.invoice_number}</h3>
                {invoice.is_approved ? (
                  <Badge variant="success" className="text-sm">
                    <CheckCircle2 className="h-4 w-4" />
                    Approved
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-sm">
                    Pending Review
                  </Badge>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-xl border-[#e4e7ec] shadow-none">
              <CardHeader>
                <CardTitle className="text-2xl">Vendor Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Separator />
                <Controller
                  name="vendor_name"
                  control={control}
                  render={({ field, fieldState: { error } }) => (
                    <div className="space-y-1">
                      <Label>Vendor Name</Label>
                      <Input {...field} value={field.value ?? ''} disabled={invoice.is_approved} />
                      {error?.message && <p className="text-xs text-red-600">{error.message}</p>}
                    </div>
                  )}
                />
                <Controller
                  name="vendor_gst_tin"
                  control={control}
                  render={({ field, fieldState: { error } }) => (
                    <div className="space-y-1">
                      <Label>GST/TIN</Label>
                      <Input {...field} value={field.value ?? ''} disabled={invoice.is_approved} />
                      {error?.message && <p className="text-xs text-red-600">{error.message}</p>}
                    </div>
                  )}
                />
                <Controller
                  name="vendor_address"
                  control={control}
                  render={({ field, fieldState: { error } }) => (
                    <div className="space-y-1">
                      <Label>Address</Label>
                      <textarea
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        disabled={invoice.is_approved}
                        rows={3}
                        className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                      />
                      {error?.message && <p className="text-xs text-red-600">{error.message}</p>}
                    </div>
                  )}
                />
              </CardContent>
            </Card>

            <Card className="rounded-xl border-[#e4e7ec] shadow-none">
              <CardHeader>
                <CardTitle className="text-2xl">Invoice Details</CardTitle>
              </CardHeader>
              <CardContent>
                <Separator className="mb-3" />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Controller
                    name="invoice_number"
                    control={control}
                    render={({ field }) => (
                      <div className="space-y-1">
                        <Label>Invoice Number</Label>
                        <Input {...field} disabled={invoice.is_approved} />
                      </div>
                    )}
                  />
                  <Controller
                    name="invoice_currency"
                    control={control}
                    render={({ field }) => (
                      <div className="space-y-1">
                        <Label>Currency</Label>
                        <Input {...field} disabled={invoice.is_approved} />
                      </div>
                    )}
                  />
                  <Controller
                    name="invoice_date"
                    control={control}
                    render={({ field }) => (
                      <div className="space-y-1">
                        <Label>Invoice Date</Label>
                        <Input
                          type="date"
                          value={toDateInputValue(field.value)}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value ? new Date(`${e.target.value}T00:00:00`) : new Date(),
                            )
                          }
                          disabled={invoice.is_approved}
                        />
                      </div>
                    )}
                  />
                  <Controller
                    name="invoice_due_date"
                    control={control}
                    render={({ field }) => (
                      <div className="space-y-1">
                        <Label>Due Date</Label>
                        <Input
                          type="date"
                          value={toDateInputValue(field.value)}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value ? new Date(`${e.target.value}T00:00:00`) : new Date(),
                            )
                          }
                          disabled={invoice.is_approved}
                        />
                      </div>
                    )}
                  />
                  <div className="space-y-1">
                    <Label>PO Number</Label>
                    <Input value={invoice.po_number || 'N/A'} disabled />
                  </div>
                  <Controller
                    name="payment_terms"
                    control={control}
                    render={({ field }) => (
                      <div className="space-y-1">
                        <Label>Payment Terms</Label>
                        <Input
                          {...field}
                          value={field.value ?? ''}
                          disabled={invoice.is_approved}
                        />
                      </div>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl border-[#e4e7ec] shadow-none">
              <CardHeader>
                <CardTitle className="text-2xl">Financial Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <Separator className="mb-3" />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Controller
                    name="invoice_subtotal"
                    control={control}
                    render={({ field }) => (
                      <div className="space-y-1">
                        <Label>Subtotal</Label>
                        <Input
                          type="number"
                          value={field.value ?? 0}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          disabled={invoice.is_approved}
                        />
                      </div>
                    )}
                  />
                  <Controller
                    name="total_tax_amount"
                    control={control}
                    render={({ field }) => (
                      <div className="space-y-1">
                        <Label>Tax Amount</Label>
                        <Input
                          type="number"
                          value={field.value ?? 0}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          disabled={invoice.is_approved}
                        />
                      </div>
                    )}
                  />
                  <Controller
                    name="total_discount_amount"
                    control={control}
                    render={({ field }) => (
                      <div className="space-y-1">
                        <Label>Discount</Label>
                        <Input
                          type="number"
                          value={field.value ?? 0}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          disabled={invoice.is_approved}
                        />
                      </div>
                    )}
                  />
                  <Controller
                    name="shipping_charges"
                    control={control}
                    render={({ field }) => (
                      <div className="space-y-1">
                        <Label>Shipping Charges</Label>
                        <Input
                          type="number"
                          value={field.value ?? 0}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          disabled={invoice.is_approved}
                        />
                      </div>
                    )}
                  />
                  <Controller
                    name="other_charges"
                    control={control}
                    render={({ field }) => (
                      <div className="space-y-1">
                        <Label>Other Charges</Label>
                        <Input
                          type="number"
                          value={field.value ?? 0}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          disabled={invoice.is_approved}
                        />
                      </div>
                    )}
                  />
                  <div className="space-y-1">
                    <Label>Total Amount</Label>
                    <Input
                      value={`₹ ${calculatedTotal.toFixed(2)}`}
                      disabled
                      className="font-semibold"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl border-[#e4e7ec] shadow-none">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-2xl">Line Items</CardTitle>
                {!invoice.is_approved && (
                  <Button size="sm" variant="outline" onClick={handleAddLineItem}>
                    <Plus className="h-4 w-4" />
                    Add Line Item
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <Separator className="mb-3" />
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Unit Price</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Tax</TableHead>
                        <TableHead>Total</TableHead>
                        {!invoice.is_approved && <TableHead>Action</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fields.map((field, index) => (
                        <TableRow key={field.id}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>
                            <Controller
                              name={`line_items.${index}.description`}
                              control={control}
                              render={({ field }) => (
                                <Input
                                  {...field}
                                  value={field.value ?? ''}
                                  disabled={invoice.is_approved}
                                />
                              )}
                            />
                          </TableCell>
                          <TableCell>
                            <Controller
                              name={`line_items.${index}.quantity`}
                              control={control}
                              render={({ field }) => (
                                <Input
                                  type="number"
                                  value={field.value ?? 0}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                  disabled={invoice.is_approved}
                                />
                              )}
                            />
                          </TableCell>
                          <TableCell>
                            <Controller
                              name={`line_items.${index}.unit_price`}
                              control={control}
                              render={({ field }) => (
                                <Input
                                  type="number"
                                  value={field.value ?? 0}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                  disabled={invoice.is_approved}
                                />
                              )}
                            />
                          </TableCell>
                          <TableCell>₹{calculateLineAmount(index).toFixed(2)}</TableCell>
                          <TableCell>
                            <Controller
                              name={`line_items.${index}.tax_amount`}
                              control={control}
                              render={({ field }) => (
                                <Input
                                  type="number"
                                  value={field.value ?? 0}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                  disabled={invoice.is_approved}
                                />
                              )}
                            />
                          </TableCell>
                          <TableCell className="font-semibold">
                            ₹{calculateLineTotal(index).toFixed(2)}
                          </TableCell>
                          {!invoice.is_approved && (
                            <TableCell>
                              <Button variant="ghost" size="icon-sm" onClick={() => remove(index)}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Trash2 className="h-4 w-4 text-red-600" />
                                  </TooltipTrigger>
                                  <TooltipContent sideOffset={6}>Remove line item</TooltipContent>
                                </Tooltip>
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl border-[#e4e7ec] shadow-sm">
              <CardContent>
                <div className="flex flex-wrap justify-end gap-2">
                  {!invoice.is_approved ? (
                    <>
                      <Button type="submit" disabled={!isDirty || updateMutation.isPending}>
                        <Save className="h-4 w-4" />
                        {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setOpenUncategorise(true)}
                      >
                        <XCircle className="h-4 w-4" />
                        Uncategorise
                      </Button>
                    </>
                  ) : (
                    <Badge variant="success" className="text-sm">
                      <CheckCircle2 className="h-4 w-4" />
                      This invoice is approved and cannot be edited
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </form>
        </div>
      </div>

      <UncategoriseInvoiceDialog
        open={openUncategorise}
        onClose={() => setOpenUncategorise(false)}
        onConfirm={handleConfirmUncategorise}
        isUncategorising={uncategoriseMutation.isPending}
      />
    </>
  )
}
