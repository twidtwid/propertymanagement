// Bank of America CSV fixtures for testing

export const VALID_BOA_CSV = `Description,,Summary Coverage
Checking Account,,1234567890
Beginning balance as of 12/01/2025,,"$25,000.00"
Total credits,,2
Total debits,,8
Ending balance as of 12/31/2025,,"$22,543.21"

Date,Description,Amount,Running Bal.
12/28/2025,"Check 363",-450.00,22543.21
12/27/2025,"Parker Construction Bill Payment",-2500.00,22993.21
12/25/2025,"Bill Pay Check 7151: Ocean State Elec. Sec. Syst.,I",-89.00,25493.21
12/22/2025,"GrMtnPower DES:GrMtnPwr",-185.32,25582.21
12/20/2025,"PPL Rhode Island DES:UTIL. BILL",-142.55,25767.53
12/18/2025,"Edge 11211 Condo DES:WEB PMTS",-850.00,25910.08
12/15/2025,"WIRE TYPE:WIRE OUT INTL",-3500.00,26760.08
12/10/2025,"APPLECARD Payment",-1200.00,30260.08
12/05/2025,"Interest Earned",15.43,31460.08
12/01/2025,"VENMO CASHOUT",500.00,31444.65
`

export const MINIMAL_CSV = `Date,Description,Amount
12/15/2025,"Check 100",-500.00
12/14/2025,"ACME Corp Bill Payment",-1000.00
`

export const EMPTY_CSV = ``

export const NO_DATA_ROWS_CSV = `Date,Description,Amount,Running Bal.
`

export const CSV_WITH_QUOTES_IN_DESCRIPTION = `Date,Description,Amount,Running Bal.
12/15/2025,"Check 123 - ""Test Payment""",-500.00,10000.00
12/14/2025,"Bill Pay Check 456: ""ABC Company"" Inc.",-250.00,10500.00
`

export const CSV_WITH_COMMAS_IN_AMOUNT = `Date,Description,Amount,Running Bal.
12/15/2025,"Check 789","-1,500.00","10,000.00"
12/14/2025,"Large Payment","-25,000.00","11,500.00"
`

export const CSV_WITH_NOISE_TRANSACTIONS = `Date,Description,Amount,Running Bal.
12/15/2025,"Check 100",-500.00,10000.00
12/14/2025,"PAYPAL TRANSFER",-50.00,10500.00
12/13/2025,"UBER RIDES",-25.00,10550.00
12/12/2025,"VENMO PAYMENT",-100.00,10575.00
12/11/2025,"Parker Construction Bill Payment",-2500.00,10675.00
12/10/2025,"Interest Earned",5.00,13175.00
`

export const CSV_WITH_ALL_CATEGORIES = `Date,Description,Amount,Running Bal.
12/20/2025,"Check 500",-1000.00,20000.00
12/19/2025,"Bill Pay Check 7151: Vendor Name",-500.00,21000.00
12/18/2025,"Parker Construction Bill Payment",-2500.00,21500.00
12/17/2025,"GrMtnPower DES:GrMtnPwr",-185.00,24000.00
12/16/2025,"WIRE TYPE:WIRE OUT INTL",-5000.00,24185.00
12/15/2025,"Online Banking transfer To Savings",-1000.00,29185.00
12/14/2025,"APPLECARD Payment",-500.00,30185.00
12/13/2025,"PAYPAL CASHOUT",-100.00,30685.00
12/12/2025,"ACME Corp Payment",-750.00,30785.00
`
