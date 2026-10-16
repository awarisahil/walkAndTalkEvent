-- AlterTable
ALTER TABLE "PasswordResetOtp" ADD COLUMN     "purpose" TEXT NOT NULL DEFAULT 'PASSWORD_RESET';

-- CreateIndex
CREATE INDEX "PasswordResetOtp_purpose_idx" ON "PasswordResetOtp"("purpose");

