import frappe
import requests
from datetime import date
import json
import qrcode
import base64
import io

from pos.pos.doctype.ebarimt_settings.ebarimt_settings import EbarimtSettings
from pos.pos.doctype.ebarimt_merchant_info.ebarimt_merchant_info import EbarimtMerchantInfo
from pos.pos.doctype.ebarimt_receipt.ebarimt_receipt import EbarimtReceipt

@frappe.whitelist()
def get_merchant_info(regNo: str):
    infoUrl = frappe.db.get_single_value("Ebarimt Settings", "info_url")

    resp = requests.get(infoUrl, {'regno': regNo})

    if(resp.status_code != 200):
        frappe.throw('Error while fetching metchant info')

    return resp.json()

def get_customerTin(regNo: str):
    resp = requests.get('https://api.ebarimt.mn/api/info/check/getTinInfo', {'regNo': regNo})

    data = resp.json()
    if(resp.status_code != 200 or data["status"] != 200):
        raise(Exception("Error get_customerTin"))
        # frappe.throw('Error while fetching metchant info')

    return data["data"]

@frappe.whitelist()
def submit_receipt(receiptParams, invoiceDoc):
    receiptParams = json.loads(receiptParams)
    invoiceDoc = json.loads(invoiceDoc)
    
    baseUrl = frappe.db.get_single_value("Ebarimt Settings", "base_url")

    merchant: EbarimtMerchantInfo = None
    try:
        merchant_name = frappe.db.get_value("POS Profile", invoiceDoc["pos_profile"], "custom_ebarimt_merchant_info")
        merchant = frappe.get_doc("Ebarimt Merchant Info", merchant_name)
    except Exception as err:
        frappe.throw('Merchant info not found')
        return None

    body = {
        "branchNo": merchant.branch_no,
        "totalAmount": invoiceDoc["net_total"],
        "totalVat": invoiceDoc["net_total"] / 11,
        "districtCode": merchant.district_code,
        "merchantTin": merchant.merchant_tin,
        "posNo": merchant.pos_no,
        "type": receiptParams["type"],
        "billIdSuffix": f"POS-{date.today()}",
        "customerTin": None if receiptParams["type"] == 'B2C_RECEIPT' else get_customerTin(receiptParams["companyReg"]),
        "receipts": [
            {
                "totalAmount": invoiceDoc["net_total"],
                "totalVat": invoiceDoc["net_total"] / 11,
                "taxType": "VAT_ABLE",
                "merchantTin": merchant.merchant_tin,
                "type": receiptParams["type"],
                "items": [
                    {
                        "name": item["item_name"],
                        "barCode": item["barcode"],
                        "barCodeType": "GS1",
                        "classificationCode": "3212911",
                        "measureUnit": item["uom"],
                        "qty": item["qty"],
                        "unitPrice": item["net_rate"],
                        "totalAmount": item["net_amount"],
                        "totalVat": item["net_amount"] / 11,
                    } for item in invoiceDoc["items"]
                ]
            }
        ],
        "payments": [
            {
            "code": "CASH",
            "status": "PAID",
            "paidAmount": invoiceDoc["net_total"]
            }
        ]
    }

    resp = requests.post(baseUrl + "/rest/receipt", json=body)
    resp_data = resp.json()

    if(resp_data["status"] != "SUCCESS"):
        frappe.throw(f"Ebarimt unsuccessful: {resp_data['message']}")
        return None

    doc: EbarimtReceipt = frappe.new_doc("Ebarimt Receipt")
    doc.data = json.dumps(resp_data)
    doc.insert()

    return doc

def get_customerInfo(customerTin: str):
    resp = requests.get('https://api.ebarimt.mn/api/info/check/getInfo', {'tin': customerTin})

    data = resp.json()
    if(resp.status_code != 200 or data["status"] != 200):
        raise(Exception("Error get_customerInfo"))
        # frappe.throw('Error while fetching metchant info')

    return data["data"]

def generate_qrcode_data_url(qrData):
    img = qrcode.make(qrData, border=0)
    buffer = io.BytesIO()
    img.save(buffer)
    img_str = base64.b64encode(buffer.getvalue()).decode()
    buffer.seek(0)
    buffer.truncate(0)
    return "data:image/png;base64, " + img_str

@frappe.whitelist()
def print_format_data(receiptName):
    receipt_data = json.loads(frappe.db.get_value("Ebarimt Receipt", receiptName, "data"))
    # receipt_data

    if(receipt_data["type"] == "B2B_RECEIPT"):
        customerInfo = get_customerInfo(receipt_data["customerTin"])
        receipt_data["customerName"] = customerInfo["name"]
    receipt_data["qrImage"] = generate_qrcode_data_url(receipt_data["qrData"])

    return receipt_data