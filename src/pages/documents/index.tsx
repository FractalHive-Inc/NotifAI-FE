import { useNavigate } from 'react-router-dom'
import { BookOpen, FolderOpen, Receipt, Send } from 'lucide-react'
import { Card, CardContent } from '@/shared/components/ui/card/card'

interface HubCard {
  title: string
  description: string
  href: string
  icon: React.ReactNode
  iconWrapClass: string
}

const cards: HubCard[] = [
  {
    title: 'All Documents',
    description: 'Browse every document received across all emails.',
    href: '/documents/all',
    icon: <BookOpen className="h-5 w-5 text-blue-600" />,
    iconWrapClass: 'bg-blue-50',
  },
  {
    title: 'Invoices',
    description: 'Documents classified as invoices, with extracted fields.',
    href: '/documents/invoices',
    icon: <Receipt className="h-5 w-5 text-violet-600" />,
    iconWrapClass: 'bg-violet-50',
  },
  {
    title: 'PO Folders',
    description: 'Documents grouped by purchase order number.',
    href: '/documents/po-folders',
    icon: <FolderOpen className="h-5 w-5 text-emerald-600" />,
    iconWrapClass: 'bg-emerald-50',
  },
  {
    title: 'Discounting Requests',
    description: 'Approved invoices sent to LOS for discounting.',
    href: '/documents/discounting-requests',
    icon: <Send className="h-5 w-5 text-amber-600" />,
    iconWrapClass: 'bg-amber-50',
  },
]

export default function DocumentsHubPage() {
  const navigate = useNavigate()

  return (
    <div className="w-full">
      <h2 className="text-2xl font-bold text-[#043463] sm:text-3xl">Documents</h2>
      <p className="mt-2 text-sm text-muted-foreground sm:text-base">
        Everything received into NotifAI — pick a view to dive in.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card
            key={card.title}
            role="button"
            tabIndex={0}
            onClick={() => navigate(card.href)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                navigate(card.href)
              }
            }}
            className="cursor-pointer rounded-xl border-[#e4e7ec] py-5 shadow-none transition-colors hover:border-[#c8d0db]"
          >
            <CardContent className="flex flex-col gap-3">
              <div className={`w-fit rounded-lg p-2 ${card.iconWrapClass}`}>{card.icon}</div>
              <div>
                <p className="text-lg font-semibold text-[#0f172a]">{card.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{card.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
