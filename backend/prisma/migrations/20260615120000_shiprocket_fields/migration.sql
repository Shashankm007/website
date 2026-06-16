-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "awbCode" TEXT,
ADD COLUMN     "courierName" TEXT,
ADD COLUMN     "shiprocketOrderId" TEXT,
ADD COLUMN     "shiprocketShipmentId" TEXT,
ADD COLUMN     "trackingUrl" TEXT;

