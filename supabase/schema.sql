-- Create custom types
CREATE TYPE user_role AS ENUM ('admin', 'resident');
CREATE TYPE ledger_entry_type AS ENUM ('income', 'expense');

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'resident',
  apartment_id INTEGER,
  access_code VARCHAR(6) UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Apartments table
CREATE TABLE public.apartments (
  id SERIAL PRIMARY KEY,
  apartment_number INTEGER UNIQUE NOT NULL,
  resident_name VARCHAR(255) NOT NULL,
  owner_name VARCHAR(255),
  has_elevator BOOLEAN DEFAULT true,
  access_code VARCHAR(6) UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Monthly dues table
CREATE TABLE public.monthly_dues (
  id SERIAL PRIMARY KEY,
  apartment_id INTEGER NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  carried_debt DECIMAL(10, 2) DEFAULT 0,
  elevator_payment DECIMAL(10, 2) DEFAULT 0,
  total_paid DECIMAL(10, 2) DEFAULT 0,
  balance DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(apartment_id, year)
);

-- Monthly payments table
CREATE TABLE public.monthly_payments (
  id SERIAL PRIMARY KEY,
  monthly_dues_id INTEGER NOT NULL REFERENCES monthly_dues(id) ON DELETE CASCADE,
  month VARCHAR(20) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(monthly_dues_id, month)
);

-- Extra fees table
CREATE TABLE public.extra_fees (
  id SERIAL PRIMARY KEY,
  monthly_dues_id INTEGER NOT NULL REFERENCES monthly_dues(id) ON DELETE CASCADE,
  fee_name VARCHAR(100) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Dues columns table (for custom fee types)
CREATE TABLE public.dues_columns (
  id SERIAL PRIMARY KEY,
  column_name VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ledger entries table
CREATE TABLE public.ledger_entries (
  id SERIAL PRIMARY KEY,
  month VARCHAR(20) NOT NULL,
  type ledger_entry_type NOT NULL,
  description TEXT NOT NULL,
  person VARCHAR(255),
  amount DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Staff records table
CREATE TABLE public.staff_records (
  id SERIAL PRIMARY KEY,
  month VARCHAR(20) UNIQUE NOT NULL,
  manager_salary DECIMAL(10, 2) DEFAULT 0,
  cleaner_salary DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key constraint for users.apartment_id
ALTER TABLE public.users
  ADD CONSTRAINT fk_users_apartment
  FOREIGN KEY (apartment_id)
  REFERENCES apartments(id)
  ON DELETE SET NULL;

-- Create indexes for better query performance
CREATE INDEX idx_monthly_dues_apartment ON monthly_dues(apartment_id);
CREATE INDEX idx_monthly_payments_dues ON monthly_payments(monthly_dues_id);
CREATE INDEX idx_extra_fees_dues ON extra_fees(monthly_dues_id);
CREATE INDEX idx_ledger_entries_month ON ledger_entries(month);
CREATE INDEX idx_users_apartment ON users(apartment_id);
CREATE INDEX idx_users_access_code ON users(access_code);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apartments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_dues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extra_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dues_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view their own data"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all users"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can insert users"
  ON public.users FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update users"
  ON public.users FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for apartments table
CREATE POLICY "Admins can view all apartments"
  ON public.apartments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Residents can view their apartment"
  ON public.apartments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND apartment_id = apartments.id
    )
  );

CREATE POLICY "Admins can manage apartments"
  ON public.apartments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for monthly_dues table
CREATE POLICY "Admins can view all dues"
  ON public.monthly_dues FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Residents can view their dues"
  ON public.monthly_dues FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND apartment_id = monthly_dues.apartment_id
    )
  );

CREATE POLICY "Admins can manage dues"
  ON public.monthly_dues FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for monthly_payments table
CREATE POLICY "Admins can view all payments"
  ON public.monthly_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Residents can view their payments"
  ON public.monthly_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN monthly_dues md ON u.apartment_id = md.apartment_id
      WHERE u.id = auth.uid() AND md.id = monthly_payments.monthly_dues_id
    )
  );

CREATE POLICY "Admins can manage payments"
  ON public.monthly_payments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for extra_fees table
CREATE POLICY "Admins can view all extra fees"
  ON public.extra_fees FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Residents can view their extra fees"
  ON public.extra_fees FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN monthly_dues md ON u.apartment_id = md.apartment_id
      WHERE u.id = auth.uid() AND md.id = extra_fees.monthly_dues_id
    )
  );

CREATE POLICY "Admins can manage extra fees"
  ON public.extra_fees FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for dues_columns table
CREATE POLICY "Everyone can view dues columns"
  ON public.dues_columns FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage dues columns"
  ON public.dues_columns FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for ledger_entries table (admin only)
CREATE POLICY "Admins can manage ledger entries"
  ON public.ledger_entries FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for staff_records table (admin only)
CREATE POLICY "Admins can manage staff records"
  ON public.staff_records FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for apartments table
CREATE TRIGGER update_apartments_updated_at
  BEFORE UPDATE ON apartments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
