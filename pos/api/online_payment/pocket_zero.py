import requests
import json
import secrets

import frappe
from pos.pos.doctype.pocket_zero_settings.pocket_zero_settings import PocketZeroSettings
from pos.pos.doctype.pocket_zero_api_settings.pocket_zero_api_settings import PocketZeroAPISettings
from pos.pos.doctype.online_payment_invoice.online_payment_invoice import OnlinePaymentInvoice

def get_auth_token():
    pocketZeroAPISettings: PocketZeroAPISettings = frappe.get_single("Pocket Zero API Settings")
    
    req = requests.post(
        url="https://sso.invescore.mn/auth/realms/invescore/protocol/openid-connect/token",
        headers={
            "Content-Type": "application/x-www-form-urlencoded"
        },
        data={
            "client_id": pocketZeroAPISettings.client_id,
            "client_secret": pocketZeroAPISettings.client_secret,
            "grant_type": "client_credentials"
        }
    )

    data = req.json()

    if(req.status_code != 200):
        if("error" in data and "error_description" in data):
            frappe.throw(f"[Pocket Zero auth] {data['error_description']}")
        else:
            frappe.throw("Error occured in Pocket Zero auth")

    return data

@frappe.whitelist()
def create_invoice(pocketZeroSettingsName, amount):
    pocketZeroSettings: PocketZeroSettings = frappe.get_doc("Pocket Zero Settings", pocketZeroSettingsName)

    op_inv_doc: OnlinePaymentInvoice = frappe.new_doc("Online Payment Invoice")

    op_inv_doc.status = "Unpaid"
    op_inv_doc.payment_settings_type = "Pocket Zero Settings"
    op_inv_doc.payment_settings = pocketZeroSettingsName
    op_inv_doc.amount = amount
    op_inv_doc.secret = 'pocketzero-' + secrets.token_urlsafe(16)
    op_inv_doc.insert()

    auth = get_auth_token()

    req = requests.post(
        url="https://service.invescore.mn/merchant/v2/invoicing/generate-invoice",
        headers={
            "Authorization": f"Bearer {auth['access_token']}"
        },
        json={
            "terminalId": pocketZeroSettings.terminal_id,
            "amount": amount,
            "info": op_inv_doc.name,
            "orderNumber": op_inv_doc.name,
            "invoiceType": "ZERO",
            "channel": "ecommerce",
        }
    )

    data = req.json()

    if(req.status_code != 200):
        message = "- "
        if("message" in data):
            message += data["message"]

        frappe.throw(f"[Pocket Zero] Unable to create invoice {message}")
        return

    op_inv_doc.data = json.dumps(data)
    op_inv_doc.save()
    frappe.db.commit()

    # [TODOOOOOO] Handle secrets securely
    # hack pls fix
    op_inv_doc.secret = None

    return op_inv_doc

def check_invoice(op_inv_doc: OnlinePaymentInvoice):
    data = json.loads(op_inv_doc.data)

    auth = get_auth_token()
    pocketZeroSettings: PocketZeroSettings = frappe.get_doc(op_inv_doc.payment_settings_type, op_inv_doc.payment_settings)

    req = requests.post(
        url="https://service.invescore.mn/merchant/v2/invoicing/invoices/is-paid",
        headers={
            "Authorization": f"Bearer {auth['access_token']}"
        },
        json={
            "terminalId": pocketZeroSettings.terminal_id,
            "orderNumber": data["orderNumber"],
        }
    )

    if(req.status_code == 200):
        return True
    elif(req.status_code == 400):
        frappe.msgprint("[Pocket Zero] Invoice in pending or cancelled")
    else:
        frappe.throw("[Pocket Zero] Error checking invoice")
        return False