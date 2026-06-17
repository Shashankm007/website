-- AlterTable
ALTER TABLE "cart_items" ADD COLUMN     "modelLink" TEXT;

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "customUploadUrl" TEXT,
ADD COLUMN     "modelLink" TEXT;

