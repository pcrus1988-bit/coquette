import { OrderConfirmationPage } from "../../../../components/order-confirmation-page"

export default async function EnglishOrderConfirmationRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return <OrderConfirmationPage language="en" orderId={id} />
}
