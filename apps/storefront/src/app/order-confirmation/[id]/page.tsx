import { OrderConfirmationPage } from "../../../components/order-confirmation-page"

export default async function OrderConfirmationRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return <OrderConfirmationPage language="el" orderId={id} />
}
