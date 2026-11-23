CREATE TABLE bank_transfer_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  bank_name varchar(160) NOT NULL DEFAULT '',
  account_holder_name varchar(180) NOT NULL DEFAULT '',
  iban varchar(64) NOT NULL DEFAULT '',
  account_number varchar(80),
  swift_code varchar(32),
  support_whatsapp varchar(24) NOT NULL DEFAULT '',
  instructions text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO bank_transfer_settings (id) VALUES (1);
