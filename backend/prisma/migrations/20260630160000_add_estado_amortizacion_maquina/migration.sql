-- Add persisted amortization status on machines.
ALTER TABLE "Maquina"
ADD COLUMN "estadoAmortizacion" TEXT NOT NULL DEFAULT 'SIN_DATOS';
