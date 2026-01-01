// Bill fixtures for transaction matching tests

export interface MockBill {
  id: string
  description: string | null
  amount: number
  due_date: string
  status: string
  payment_method: string | null
  payment_date: string | null
  payment_reference: string | null
  vendor_id: string | null
  property_id: string | null
  vendor_name?: string
  vendor_company?: string
  property_name?: string
}

export const MOCK_BILLS: MockBill[] = [
  {
    id: 'bill-1',
    description: 'Monthly maintenance',
    amount: 450.00,
    due_date: '2025-12-25',
    status: 'sent',
    payment_method: 'check',
    payment_date: '2025-12-26',
    payment_reference: '363',
    vendor_id: 'vendor-1',
    property_id: 'property-1',
    vendor_name: 'John Smith',
    vendor_company: 'Maintenance Co',
    property_name: 'Main House',
  },
  {
    id: 'bill-2',
    description: 'Construction work',
    amount: 2500.00,
    due_date: '2025-12-20',
    status: 'pending',
    payment_method: null,
    payment_date: null,
    payment_reference: null,
    vendor_id: 'vendor-2',
    property_id: 'property-1',
    vendor_name: 'Justin',
    vendor_company: 'Parker Construction',
    property_name: 'Main House',
  },
  {
    id: 'bill-3',
    description: 'Security system monitoring',
    amount: 89.00,
    due_date: '2025-12-22',
    status: 'sent',
    payment_method: 'check',
    payment_date: '2025-12-23',
    payment_reference: '7151',
    vendor_id: 'vendor-3',
    property_id: 'property-2',
    vendor_name: 'Ocean State Security',
    vendor_company: 'Ocean State Elec. Sec. Syst.',
    property_name: 'RI House',
  },
  {
    id: 'bill-4',
    description: 'Electric bill',
    amount: 185.32,
    due_date: '2025-12-20',
    status: 'pending',
    payment_method: 'auto_pay',
    payment_date: null,
    payment_reference: null,
    vendor_id: 'vendor-4',
    property_id: 'property-3',
    vendor_name: 'Green Mountain Power',
    vendor_company: 'GrMtnPower',
    property_name: 'Vermont Main',
  },
  {
    id: 'bill-5',
    description: 'HOA fees',
    amount: 850.00,
    due_date: '2025-12-15',
    status: 'pending',
    payment_method: 'auto_pay',
    payment_date: null,
    payment_reference: null,
    vendor_id: 'vendor-5',
    property_id: 'property-4',
    vendor_name: 'Edge 11211 Condo',
    vendor_company: null,
    property_name: 'Brooklyn PH2E',
  },
]

export const BILL_WITH_NO_VENDOR: MockBill = {
  id: 'bill-no-vendor',
  description: 'Miscellaneous expense',
  amount: 500.00,
  due_date: '2025-12-15',
  status: 'pending',
  payment_method: null,
  payment_date: null,
  payment_reference: null,
  vendor_id: null,
  property_id: 'property-1',
  vendor_name: undefined,
  vendor_company: undefined,
  property_name: 'Main House',
}

export const BILL_WITH_SIMILAR_AMOUNT: MockBill = {
  id: 'bill-similar',
  description: 'Similar amount bill',
  amount: 455.00, // Within 10% of 450.00
  due_date: '2025-12-25',
  status: 'pending',
  payment_method: null,
  payment_date: null,
  payment_reference: null,
  vendor_id: 'vendor-1',
  property_id: 'property-1',
  vendor_name: 'John Smith',
  vendor_company: 'Maintenance Co',
  property_name: 'Main House',
}
