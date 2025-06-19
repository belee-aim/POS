import frappe
import requests
from datetime import date
import json

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
    baseUrl = frappe.db.get_single_value("Ebarimt Settings", "base_url")

    # merchant: EbarimtMerchantInfo = frappe.get_last_doc("Ebarimt Merchant Info", "Test Merchant")
    merchant: EbarimtMerchantInfo = frappe.get_last_doc("Ebarimt Merchant Info")
    
    receiptParams = json.loads(receiptParams)
    invoiceDoc = json.loads(invoiceDoc)

    print(receiptParams)
    print(receiptParams["type"])
    
    print(merchant)
    print(merchant.name)
    print(merchant.merchant_tin)
    print(merchant.pos_no)
    print(merchant.branch_no)

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