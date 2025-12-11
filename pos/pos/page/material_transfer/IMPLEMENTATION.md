# Material Transfer Feature - Implementation Document

## Overview

The Material Transfer feature provides a POS-like interface for creating Material Request documents (type: Material Transfer) in ERPNext. This allows warehouse staff to easily request stock transfers between warehouses using a familiar, touch-friendly interface.

## Knowledge Sources

### Reference Implementation
The feature was built by studying and adapting the existing POS (Point of Sale) interface:
- **Source Location**: `pos/pos/page/pos/`
- **Key Files Studied**:
  - `pos_controller.js` - Main orchestration pattern
  - `pos_item_selector.js` - Item grid and search functionality
  - `pos_item_cart.js` - Cart management and checkout flow
  - `pos_item_details.js` - Item detail panel
  - `pos_number_pad.js` - Number pad (not used in Material Transfer)

### Frappe Framework Documentation
- **Page Creation**: https://frappeframework.com/docs/user/en/basics/pages
- **DocType API**: https://frappeframework.com/docs/user/en/api/document
- **UI Form Controls**: Frappe's `frappe.ui.form.make_control()` for dynamic form fields

### ERPNext Stock Module
- **Material Request DocType**: Standard ERPNext document for stock requisitions
- **Bin DocType**: Used for real-time stock availability queries
- **Warehouse DocType**: Filtered by company from POS Profile

## Architecture

### Component-Based Design

```
┌─────────────────────────────────────────────────────────────────────┐
│                        mt_controller.js                              │
│                     (Main Orchestrator)                              │
│                                                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │ mt_item_selector│  │   mt_item_cart  │  │ mt_item_details │     │
│  │                 │  │                 │  │                 │     │
│  │ - Item Grid     │  │ - Warehouse     │  │ - Qty Editor    │     │
│  │ - Search        │  │   Selector      │  │ - Stock Info    │     │
│  │ - Item Groups   │  │ - Cart Items    │  │ - Remove Item   │     │
│  │ - Stock Display │  │ - Totals        │  │                 │     │
│  │                 │  │ - Submit Btn    │  │                 │     │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    material_transfer_api.py                          │
│                      (Backend API)                                   │
│                                                                      │
│  - get_items()              : Fetch items with stock info           │
│  - get_stock_availability() : Real-time stock check                 │
│  - create_material_request(): Create and submit MR document         │
│  - get_pos_profile_data()   : Get company/warehouse from profile    │
└─────────────────────────────────────────────────────────────────────┘
```

### Event-Driven Communication

Components communicate through event callbacks passed during initialization:

```javascript
// Controller initializes cart with event handlers
this.cart = new erpnext.MaterialTransfer.ItemCart({
    wrapper: this.$components_wrapper,
    events: {
        cart_item_clicked: (item) => { /* open details */ },
        submit_request: () => { /* create Material Request */ },
        warehouse_changed: (type, warehouse) => { /* refresh items */ },
        get_cart_items: () => this.cart_items,
    },
});
```

### Data Flow

```
1. User selects Source Warehouse
   └─> warehouse_changed event
       └─> Controller updates from_warehouse
           └─> ItemSelector refreshes with new stock data

2. User clicks Item Card
   └─> item_selected event
       └─> Controller validates stock
           └─> Adds to cart_items object
               └─> Cart renders item HTML

3. User clicks "Request Material"
   └─> submit_request event
       └─> Controller calls API
           └─> API creates Material Request
               └─> Success: Clear cart, show message
```

## File Structure

```
pos/pos/page/material_transfer/
├── __init__.py                  # Python module marker
├── material_transfer.json       # Frappe Page definition
├── material_transfer.js         # Page entry point
├── material_transfer_api.py     # Backend API endpoints
├── mt_controller.js             # Main controller class
├── mt_item_selector.js          # Item grid component
├── mt_item_cart.js              # Cart & warehouse selector
├── mt_item_details.js           # Item detail panel
└── IMPLEMENTATION.md            # This document

pos/public/js/
└── material_transfer.bundle.js  # esbuild bundle entry

pos/public/scss/
└── material_transfer.bundle.scss # Styles (imports POS styles)
```

## Key Implementation Details

### 1. Page Registration (material_transfer.json)

```json
{
    "doctype": "Page",
    "module": "Pos",
    "name": "material-transfer",
    "page_name": "material-transfer",
    "title": "Material Transfer"
}
```

### 2. Namespace Usage

All components are registered under `erpnext.MaterialTransfer`:

```javascript
frappe.provide("erpnext.MaterialTransfer");

erpnext.MaterialTransfer.Controller = class { ... }
erpnext.MaterialTransfer.ItemSelector = class { ... }
erpnext.MaterialTransfer.ItemCart = class { ... }
erpnext.MaterialTransfer.ItemDetails = class { ... }
```

### 3. Warehouse Filtering by Company

The source warehouse selector filters by company from POS Profile:

```javascript
// In mt_item_cart.js
make_warehouse_selector() {
    const company = this.company;  // Captured in closure

    this.warehouse_field = frappe.ui.form.make_control({
        df: {
            get_query: function () {
                const filters = { is_group: 0, disabled: 0 };
                if (company) {
                    filters.company = company;
                }
                return { filters };
            },
        },
        // ...
    });
}

// Called when POS Profile data is loaded
set_company(company) {
    this.company = company;
    this.make_warehouse_selector();  // Recreate with filter
}
```

### 4. Stock Availability Display

Each item card shows both warehouse quantities:

```javascript
// Source / Target format
`<span class="from-stock">${from_qty}</span>
 <span class="stock-separator">/</span>
 <span class="to-stock">${to_qty}</span>`
```

### 5. Material Request Creation

```python
# In material_transfer_api.py
@frappe.whitelist()
def create_material_request(items, from_warehouse, to_warehouse):
    mr = frappe.new_doc("Material Request")
    mr.material_request_type = "Material Transfer"
    mr.set_warehouse = to_warehouse

    for item in items:
        mr.append("items", {
            "item_code": item.get("item_code"),
            "qty": flt(item.get("qty")),
            "warehouse": to_warehouse,        # Target
            "from_warehouse": from_warehouse, # Source
        })

    mr.insert()
    mr.submit()
    return {"name": mr.name}
```

## Differences from POS

| Aspect | POS | Material Transfer |
|--------|-----|-------------------|
| Output Document | POS Invoice | Material Request |
| Customer | Customer selector | N/A |
| Warehouse | Single (POS Profile) | Source + Target |
| Number Pad | Yes (for qty/price) | No |
| Payment | Yes | N/A |
| Barcode Scanner | Yes (onscan.js) | No |
| Stock Display | Single qty | Source/Target qty |

## Bundle Configuration

### JavaScript Bundle (material_transfer.bundle.js)

```javascript
import "../../pos/page/material_transfer/mt_item_selector.js";
import "../../pos/page/material_transfer/mt_item_cart.js";
import "../../pos/page/material_transfer/mt_item_details.js";
import "../../pos/page/material_transfer/mt_controller.js";
```

### SCSS Bundle (material_transfer.bundle.scss)

```scss
@import "../../pos/page/pos/pos.bundle";
// Additional Material Transfer specific styles if needed
```

## hooks.py Integration

```python
# Added to pos/hooks.py

# App screens for Frappe Desk
add_to_apps_screen = [
    {
        "name": "material-transfer",
        "label": _("Material Transfer"),
        "route": "/app/material-transfer",
        "category": "Modules",
    }
]

# CSS includes
app_include_css = [
    "/assets/pos/css/material_transfer.bundle.css"
]
```

## Usage

1. Navigate to `/app/material-transfer`
2. Select **Source Warehouse** (filtered by company from POS Profile)
3. Browse or search items - stock shows as `source_qty / target_qty`
4. Click items to add to cart (increments by 1)
5. Click cart item to edit quantity in detail panel
6. Click **Request Material** to create and submit Material Request

## Future Enhancements

- [ ] Barcode scanner support
- [ ] Batch/Serial number handling
- [ ] Draft saving before submission
- [ ] Multi-UOM support with conversion
- [ ] Stock reservation during cart operations
