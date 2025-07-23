import requests
import base64
import json

import frappe
from pos.pos.doctype.storepay_settings.storepay_settings import StorepaySettings
from pos.pos.doctype.storepay_api_settings.storepay_api_settings import StorepayAPISettings
from pos.pos.doctype.online_payment_invoice.online_payment_invoice import OnlinePaymentInvoice

def get_basic_auth_str(username, password):
    return base64.b64encode(f"{username}:{password}".encode("ascii")).decode('ascii')

def get_auth_token():
    storepayAPISettings: StorepayAPISettings = frappe.get_single("Storepay API Settings")
    
    req = requests.post(
        url='https://service.storepay.mn:8778/merchant-uaa/oauth/token', 
        params={
            "grant_type": "password",
            "username": storepayAPISettings.username,
            "password": storepayAPISettings.password,
        },
        headers={
            "Authorization": f"Basic {get_basic_auth_str(storepayAPISettings.app_username, storepayAPISettings.app_password)}"
        }
    )

    data = req.json()

    if(req.status_code != 200):
        if("error" in data and "error_description" in data):
            frappe.throw(f"[Storepay auth] {data['error_description']}")
        else:
            frappe.throw("Error occured in Storepay auth")

    return data

@frappe.whitelist()
def create_invoice_by_phone_number(storepaySettingsName, phone_number, amount):
    storepaySettings: StorepaySettings = frappe.get_doc("Storepay Settings", storepaySettingsName)

    auth = get_auth_token()

    req = requests.post(
        url="https://service.storepay.mn:8778/lend-merchant/merchant/loan",
        headers={
            "Authorization": f"Bearer {auth['access_token']}"
        },
        json={
            "storeId": storepaySettings.store_id,
            "mobileNumber": phone_number,
            "description": "Development test",
            "amount": amount,
        }
    )

    if(req.status_code != 200):
        frappe.throw('[Storepay] Unable to create invoice by phone number')
        return
    
    data = req.json()

    if(data["status"] == "Failed"):
        frappe.throw("".join([msg["code"] for msg in data["msgList"]]))
        return

    op_inv_doc: OnlinePaymentInvoice = frappe.new_doc("Online Payment Invoice")

    op_inv_doc.status = "Unpaid"
    op_inv_doc.payment_settings_type = "Storepay Settings"
    op_inv_doc.payment_settings = storepaySettingsName
    op_inv_doc.data = json.dumps(data)

    op_inv_doc.insert()

    return op_inv_doc

def check_invoice(data):
    data["value"] = 3090482
    req = requests.get(
        url=f"https://service.storepay.mn:8778/lend-merchant/merchant/loan/check/{data['value']}",
    )

    if(req.status_code != 200):
        frappe.throw('Error checking storepay invoice')

    data = req.json()

    if(data["status"] == "Failed"):
        frappe.throw("".join([msg["code"] for msg in data["msgList"]]))
        return
    
    return data["data"]["isConfirmed"]