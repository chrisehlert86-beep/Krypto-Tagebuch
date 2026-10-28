import MarketsDashboard from '@/components/markets/MarketsDashboard'
import PageHeader from '@/components/ui/PageHeader'

export default function MarketsPage() {
  return (
    <>
      <PageHeader
        title="Märkte"
        subtitle="Elliott-Wellen, Fibonacci-Zielzonen und Invalidierungen für BTC, ETH und SOL."
      />
      <MarketsDashboard />
    </>
  )
}
