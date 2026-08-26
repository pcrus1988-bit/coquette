import { ProductDetailShell } from "../../../../components/product-detail-shell"
import { ENGLISH_LOCALE } from "../../../../lib/localization"

export default async function EnglishProductPage({
  params,
}: {
  params: Promise<{ handle: string }>
}) {
  const { handle } = await params

  return (
    <ProductDetailShell
      handle={handle}
      language="en"
      locale={ENGLISH_LOCALE}
    />
  )
}
