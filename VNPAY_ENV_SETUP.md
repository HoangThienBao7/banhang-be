# Hướng Dẫn Cấu Hình VNPay trong .env

Thêm các biến môi trường sau vào file `back-end/.env`:

```env
# VNPay Configuration
VNPAY_TMN_CODE=44HSQHSP
VNPAY_HASH_SECRET=F0EDRCHEZW6MJ3H9QJO36K8LMI0V1SU1
VNPAY_RETURN_URL=http://localhost:3000/payment/vnpay-return
VNPAY_IPN_URL=http://localhost:8888/api/order/vnpay/ipn
VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_ENVIRONMENT=sandbox

# Client URL (cho Return URL)
CLIENT_URL=http://localhost:3000

# API URL (cho IPN URL)
API_URL=http://localhost:8888
```

## Lưu ý:

1. **VNPAY_RETURN_URL**: URL mà VNPay sẽ redirect khách hàng về sau khi thanh toán
   - Format: `http://your-domain/payment/vnpay-return`
   - Phải là public URL (không dùng localhost trong production)

2. **VNPAY_IPN_URL**: URL mà VNPay server sẽ gọi để cập nhật trạng thái thanh toán
   - Format: `http://your-domain/api/order/vnpay/ipn`
   - Phải là public URL (không dùng localhost trong production)
   - VNPay server cần truy cập được URL này

3. **VNPAY_HASH_SECRET**: Secret key từ VNPay (giữ bí mật!)

4. **VNPAY_TMN_CODE**: Terminal Code từ VNPay

5. Trong môi trường production, thay `localhost` bằng domain thực tế của bạn.

