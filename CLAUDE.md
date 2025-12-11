# AIM POS - Claude Code Guide

## Project Overview

AIM POS is a Point of Sale system built as a Frappe/ERPNext application for the Mongolian market. It provides retail management with Ebarimt (Mongolia's fiscal system) integration and online payment providers.

## Tech Stack

- **Backend**: Python 3.10+, Frappe Framework
- **Frontend**: JavaScript (ES6+), jQuery, Frappe UI, SCSS
- **Database**: MariaDB/MySQL (via Frappe)
- **Code Quality**: Ruff, ESLint, Prettier

## Project Structure

```
pos/
├── api/                        # REST API endpoints
│   ├── ebarimt.py             # Ebarimt fiscal receipt API
│   └── online_payment/        # Payment provider APIs
│       ├── invoice.py         # Multi-provider invoice coordination
│       ├── storepay.py        # Storepay integration
│       └── pocket_zero.py     # Pocket Zero integration
├── pos/
│   ├── doctype/               # Frappe DocTypes (data models)
│   ├── page/pos/              # POS frontend page
│   │   ├── pos_controller.js  # Main UI orchestrator
│   │   ├── pos_payment.js     # Payment UI component
│   │   ├── pos_item_selector.js
│   │   ├── ebarimt_dialog.js  # Ebarimt receipt dialog
│   │   └── payments/          # Payment provider JS modules
│   ├── custom/                # Custom field extensions for ERPNext
│   └── doc_hooks.py           # Document event hooks
├── public/                    # Static assets
└── hooks.py                   # Frappe app configuration
```

## Key Commands

```bash
# Install the app
bench get-app <repo-url> --branch develop
bench install-app pos

# Run development server
bench start

# Run tests
bench run-tests --app pos

# Build assets
bench build --app pos

# Clear cache
bench clear-cache

# Migrate database changes
bench migrate
```

## Code Style

- **Python**: Ruff formatting, line length 110, tabs for indentation, double quotes
- **JavaScript**: ESLint with Frappe globals, Prettier formatting
- Pre-commit hooks enforce code quality

## Key Modules

### Ebarimt API (`pos/api/ebarimt.py`)
- `submit_receipt()` - Submit fiscal receipt
- `return_receipt()` - Cancel receipt
- `update_receipt()` - Modify receipt
- `get_merchant_info_by_tin()` - Lookup merchant

### Online Payments (`pos/api/online_payment/`)
- Storepay and Pocket Zero integration
- OAuth token management
- Invoice creation and status checking

## DocTypes

| DocType | Purpose |
|---------|---------|
| Ebarimt Settings | Global Ebarimt config |
| Ebarimt Merchant Info | Per-merchant settings |
| Ebarimt Receipt | Receipt records |
| Online Payment Invoice | Payment tracking |
| Storepay/Pocket Zero Settings | Provider config |

## Extended ERPNext DocTypes

- **POS Invoice** - Added Ebarimt receipt link
- **Item** - Tax type classification for Ebarimt
- **POS Profile** - Online payment methods, merchant info

## Development Notes

- Follow Frappe patterns for DocTypes and API
- Use `frappe.call()` for frontend API calls
- Use `@frappe.whitelist()` decorator for public APIs
- Tax types: VAT_ABLE, VAT_FREE, VAT_ZERO, NOT_VAT
