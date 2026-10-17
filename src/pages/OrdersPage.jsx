import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useStore } from '../store/useStore';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';

const money = (n) => `$${(Number.isFinite(Number(n)) ? Number(n) : 0).toFixed(2)}`;

export default function OrdersPage() {
  const orders = useStore((s) => s.orders);
  const navigate = useNavigate();

  const [params, setParams] = useSearchParams();
  const sessionId = params.get('session_id');
  const placeOrder = useStore((s) => s.placeOrder);
  const [verifying, setVerifying] = useState(Boolean(sessionId));

  useEffect(() => {
    if (!sessionId) return undefined;
    let ignore = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/checkout-session/${encodeURIComponent(sessionId)}`);
        const data = await res.json().catch(() => ({}));
        if (ignore) return;
        if (!res.ok || !data.paid) throw new Error('Payment not confirmed');
        const exists = useStore.getState().orders.some((o) => o.orderNo === data.order.orderNo);
        if (!exists) placeOrder(data.order); // records the order, clears cart and coupon
        toast.success(`Order confirmed! Receipt #${data.order.orderNo}`);
        setParams({}, { replace: true });
      } catch {
        if (!ignore) toast.error("We couldn't confirm your payment. If you were charged, contact support.");
      } finally {
        if (!ignore) setVerifying(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [sessionId, placeOrder, setParams]);

  return (
    <div className="section-wrap">
      <button className="icon-btn back-btn" onClick={() => navigate('/')}>
        ← Back to Shop
      </button>
      <h2>Order History</h2>
      {verifying && <p className="text-muted" role="status">Confirming your payment…</p>}
      {orders.length === 0 && !verifying ? (
        <p className="text-muted margin-top-20">No orders placed yet.</p>
      ) : (

        <div className="orders-list">
          {orders.map((o) => {
            const date = new Date(o.date);
            const hasBreakdown = Number.isFinite(o.subtotal); // false for older orders
            const discount = Number(o.discount) || 0;
            const shipping = Number.isFinite(o.shipping) ? o.shipping : null;
            const couponCode = typeof o.coupon === 'string' ? o.coupon : o.coupon?.code;

            return (
              <div key={o.orderNo} className="order-card">
                <div className="order-card-head">
                  <span className="mono order-no">#{o.orderNo}</span>
                  <span className="order-date">
                    {Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString()}
                  </span>
                </div>
                <div className="order-items">
                  {(o.items ?? []).map((i) => `${i.qty}x ${i.name}`).join(', ')}
                </div>

                {hasBreakdown && (
                  <div className="mono text-muted">
                    <div>Subtotal: {money(o.subtotal)}</div>
                    {discount > 0 && (
                      <div>
                        Discount{couponCode ? ` (${couponCode})` : ''}: -{money(discount)}
                      </div>
                    )}
                    {shipping !== null && (
                      <div>Shipping: {shipping === 0 ? 'Free' : money(shipping)}</div>
                    )}
                  </div>
                )}

                <div className="mono order-total">Total: {money(o.total)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}