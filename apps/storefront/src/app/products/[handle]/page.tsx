import { ProductDetailShell } from "../../../components/product-detail-shell"

export default async function ProductPage({
  params,
}: {
  params: Promise<{ handle: string }>
}) {
  const { handle } = await params

  return <ProductDetailShell handle={handle} language="el" />
}
