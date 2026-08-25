import { ProductDetailShell } from "../../../../components/product-detail-shell"

const ENGLISH_LOCALE = "en-GB"

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
