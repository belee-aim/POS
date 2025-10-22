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

TAX_TYPES = [
    'VAT_ABLE',
    'VAT_FREE',
    'VAT_ZERO',
    'NOT_VAT',
]

@frappe.whitelist()
def get_merchant_info_by_regno(regNo: str):
    ebarimtSettings: EbarimtSettings = frappe.get_single("Ebarimt Settings")
    resp = requests.get(f'{ebarimtSettings.ebarimt_url}/api/info/check/getTinInfo', params={'regNo': regNo})

    if(resp.status_code != 200):
        frappe.throw('Error while fetching metchant info')

    tinInfo = resp.json()
    if(tinInfo["status"] != 200):
        return None
    
    return get_merchant_info_by_tin(str(tinInfo["data"]))

@frappe.whitelist()
def get_merchant_info_by_tin(tin: str):
    ebarimtSettings: EbarimtSettings = frappe.get_single("Ebarimt Settings")
    resp = requests.get(f'{ebarimtSettings.ebarimt_url}/api/info/check/getInfo', params={'tin': tin})

    if(resp.status_code != 200):
        frappe.throw('Error while fetching metchant info')

    return resp.json()["data"]

def get_customerTin(regNo: str):
    ebarimtSettings: EbarimtSettings = frappe.get_single("Ebarimt Settings")
    resp = requests.get(f'{ebarimtSettings.ebarimt_url}/api/info/check/getTinInfo', {'regNo': regNo})

    data = resp.json()
    if(resp.status_code != 200 or data["status"] != 200):
        raise(Exception("Error get_customerTin"))
        # frappe.throw('Error while fetching metchant info')

    return str(data["data"])

@frappe.whitelist()
def submit_receipt(receiptParams, invoiceDoc):
    receiptParams = json.loads(receiptParams)
    invoiceDoc = json.loads(invoiceDoc)
    
    ebarimtSettings: EbarimtSettings = frappe.get_single("Ebarimt Settings")
    ebarimtInfo = get_info()

    merchant: EbarimtMerchantInfo = None
    try:
        merchant_name = frappe.db.get_value("POS Profile", invoiceDoc["pos_profile"], "custom_ebarimt_merchant_info")
        merchant = frappe.get_doc("Ebarimt Merchant Info", merchant_name)
    except Exception as err:
        frappe.throw('Merchant info not found')
        return None
    
    merchant_tin = get_customerTin(merchant.merchant_register)

    vat = None
    nhat = None
    for tax in invoiceDoc["taxes"]:
        if(tax["account_head"] == ebarimtSettings.noat_account):
            vat = tax
        if(tax["account_head"] == ebarimtSettings.nhat_account):
            nhat = tax

    if(vat == None):
        frappe.throw("[Ebarimt] НӨАТ-ын данс олдсонгүй. Ebarimt-н тохиргоонд оруулна уу")
    
    totalAmount = invoiceDoc["grand_total"]
    totalVat = vat["tax_amount"]
    totalCityTax = 0 if nhat is None else nhat["tax_amount"]

    def get_item_wise_tax(tax, item):
        if(tax == None):
            return 0
        
        tax_amounts = json.loads(tax["item_wise_tax_detail"])
        if(item not in tax_amounts):
            return 0
        
        return tax_amounts[item][1]
    
    body = {
        "branchNo": merchant.branch_no,
        "totalAmount": totalAmount,
        "totalVAT": totalVat,
        "totalCityTax": totalCityTax,
        "districtCode": str(merchant.district_code).split(': ')[-1],
        "merchantTin": f"{merchant_tin}",
        "posNo": ebarimtInfo["posNo"],
        "type": receiptParams["type"],
        "reportMonth": None if (receiptParams["type"].find('B2B') == -1 or "reportMonth" not in receiptParams ) else receiptParams["reportMonth"],
        "billIdSuffix": f"POS-{date.today()}",
        "customerTin": None if receiptParams["type"].find('B2C') != -1 else get_customerTin(receiptParams["companyReg"]),
        "payments": None if receiptParams["type"].find('INVOICE') != -1 else [
            {
            "code": "CASH",
            "status": "PAID",
            "paidAmount": totalAmount
            }
        ]
    }

    body["receipts"] = []

    items_by_tax_type = {}
    for tax_type in TAX_TYPES:
        items_by_tax_type[tax_type] = []

    for item in invoiceDoc["items"]:
        item_tax_type = frappe.db.get_value("Item", item["item_code"], "custom_tax_type")
        if(item_tax_type == None):
            item_tax_type = "VAT_ABLE"
        else:
            item_tax_type = item_tax_type.split(": ")[-1]

        items_by_tax_type[item_tax_type].append(item)

    for tax_type in TAX_TYPES:
        if(len(items_by_tax_type[tax_type]) == 0):
            continue

        items = []
        for item in items_by_tax_type[tax_type]:
            classification_code = frappe.db.get_value("Item", item["item_code"], "custom_classificationcode")
            default_classification_code = frappe.db.get_single_value("Ebarimt Settings", "default_classification_code")

            barcode = item["barcode"]
            barcodeType = frappe.db.get_value("Item Barcode", filters={"barcode": barcode}, fieldname="barcode_type")

            item_vat = get_item_wise_tax(vat, item["item_code"])
            item_nhat = get_item_wise_tax(nhat, item["item_code"])

            item_amount = item["amount"]

            if(vat and vat["included_in_print_rate"] == 0):
                item_amount += item_vat
            if(nhat and nhat["included_in_print_rate"] == 0):
                item_amount += item_nhat

            items.append({
                "name": item["item_name"],
                "barCode": barcode,
                "barCodeType": "UNDEFINED" if barcodeType not in ["GS1", "ISBN"] else barcodeType,
                "classificationCode": classification_code if classification_code is not None and classification_code != "" else default_classification_code,
                "taxProductCode": None if tax_type == "VAT_ABLE" else frappe.db.get_value("Item", item["item_code"], "custom_taxproductcode").split(':')[0],
                "measureUnit": item["uom"],
                "qty": item["qty"],
                "unitPrice": item["rate"],
                "totalAmount": item_amount,
                "totalVAT": item_vat,
                "totalCityTax": item_nhat,
            })

        if(len(items) == 0):
            continue

        item_totalAmount = 0
        item_totalVAT = 0
        item_totalCityTax = 0

        for item in items:
            item_totalAmount += item["totalAmount"]
            item_totalVAT += item["totalVAT"]
            item_totalCityTax += item["totalCityTax"]

        receipt = {
            "totalAmount": item_totalAmount,
            "totalVAT": item_totalVAT,
            "totalCityTax": item_totalCityTax,
            "taxType": tax_type,
            "merchantTin": f"{merchant_tin}",
            # "bankAccountNo": None if receiptParams["type"].find('RECEIPT') != -1 else "499037985",
            "type": receiptParams["type"],
            "items": items
        }
        body["receipts"].append(receipt)

    resp = requests.post(ebarimtSettings.base_url + "/rest/receipt", json=body)
    resp_data = resp.json()

    if(resp_data["status"] != "SUCCESS"):
        frappe.throw(f"Ebarimt unsuccessful: {resp_data['message']}")
        return None
    
    doc: EbarimtReceipt = frappe.new_doc("Ebarimt Receipt")
    doc.data = json.dumps(resp_data, indent=2)
    doc.merchant_register = merchant.merchant_register
    if("companyReg" in receiptParams):
        doc.customer_register = receiptParams["companyReg"]
    doc.insert()

    return doc

def get_customerInfo(customerTin: str):
    ebarimtSettings: EbarimtSettings = frappe.get_single("Ebarimt Settings")
    resp = requests.get(f'{ebarimtSettings.ebarimt_url}/api/info/check/getInfo', {'tin': customerTin})

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
    receipt_data["merchant_register"] = frappe.db.get_value("Ebarimt Receipt", receiptName, "merchant_register")
    receipt_data["customer_register"] = frappe.db.get_value("Ebarimt Receipt", receiptName, "customer_register")

    if(receipt_data["type"].find('B2B') != -1):
        customerInfo = get_customerInfo(receipt_data["customerTin"])
        receipt_data["customerName"] = customerInfo["name"]
    receipt_data["qrImage"] = generate_qrcode_data_url(receipt_data["qrData"])

    return receipt_data

@frappe.whitelist()
def send_data():
    ebarimtSettings: EbarimtSettings = frappe.get_single("Ebarimt Settings")
    req = requests.get(ebarimtSettings.base_url + "/rest/sendData", timeout=60)

    if(req.status_code != 200):
        frappe.throw('[Ebarimt] Баримт илгээхэд алдаа гарлаа.')

    frappe.msgprint('[Ebarimt] Баримт илгээх амжилттай.')
    return None

@frappe.whitelist()
def return_receipt(invoice_doc_name):
    ebarimtSettings: EbarimtSettings = frappe.get_single("Ebarimt Settings")
    invoiceData = json.loads(frappe.get_value("Ebarimt Receipt", invoice_doc_name, "data"))

    try:
        req = requests.delete(ebarimtSettings.base_url + "/rest/receipt", json={
            "id": invoiceData["id"],
            "date": invoiceData["date"],
        })

        if(req.status_code != 200):
            frappe.throw('[Ebarimt] Баримт буцаалт амжилтгүй.')

        frappe.msgprint('[Ebarimt] Баримтыг амжилттай буцаалаа.')
        return None
    except requests.exceptions.ConnectionError:
        frappe.msgprint('[Ebarimt] Баримт буцаахад алдаа гарлаа.')

@frappe.whitelist()
def pay_invoice(invoice_doc_name, payments):
    baseUrl = frappe.db.get_single_value("Ebarimt Settings", "base_url")
    invoice: EbarimtReceipt = frappe.get_doc("Ebarimt Receipt", invoice_doc_name)
    invoiceData = json.loads(frappe.get_value("Ebarimt Receipt", invoice_doc_name, "data"))
    paymentsData = json.loads(payments)
    ebarimtInfo = get_info()

    if(invoiceData["type"].find("INVOICE") == -1):
        frappe.throw("[Ebarimt] Нэхэмжлэл биш байна.")
    invoice_type = invoiceData["type"].replace("INVOICE", "RECEIPT")

    for receipt in invoiceData["receipts"]:
        receipt["id"] = None

    body = {
        "invoiceId": invoiceData["id"],
        "branchNo": invoiceData["branchNo"],
        "totalAmount": invoiceData["totalAmount"],
        "totalVat": invoiceData["totalVAT"],
        "totalCityTax": invoiceData["totalCityTax"],
        "districtCode": invoiceData["districtCode"],
        "merchantTin": invoiceData["merchantTin"],
        "posNo": ebarimtInfo["posNo"],
        "type": invoice_type,
        "billIdSuffix": f"POS-{date.today()}",
        "customerTin": None if "customerTin" not in invoiceData else invoiceData["customerTin"],
        "reportMonth": None if "reportMonth" not in invoiceData else invoiceData["reportMonth"],
        "receipts": invoiceData["receipts"],
        "payments": [
            {
                "code": payment["code"].split(":")[0],
                "paidAmount": payment["paidAmount"],
                "status": payment["status"].split(":")[0],
            } for payment in paymentsData
        ]
    }

    try:
        resp = requests.post(baseUrl + "/rest/receipt", json=body)
        resp_data = resp.json()

        if(resp_data["status"] != "SUCCESS"):
            frappe.throw(f"[Ebarimt] Нэхэмжлэл төлөх амжилтгүй: {resp_data['message']}")
            return
        
        frappe.msgprint('[Ebarimt] Нэхэмжлэл амжилттай төлөгдлөө.')

        doc: EbarimtReceipt = frappe.new_doc("Ebarimt Receipt")
        doc.data = json.dumps(resp_data, indent=2)
        doc.merchant_register = invoice.merchant_register
        doc.customer_register = invoice.customer_register
        return doc.insert()
    except requests.exceptions.ConnectionError:
        frappe.msgprint('[Ebarimt] Нэхэмжлэлийг төлөхөд алдаа гарлаа')

@frappe.whitelist()
def update_receipt(invoice_doc_name):
    baseUrl = frappe.db.get_single_value("Ebarimt Settings", "base_url")
    invoiceData = json.loads(frappe.get_value("Ebarimt Receipt", invoice_doc_name, "data"))
    ebarimtInfo = get_info()

    for receipt in invoiceData["receipts"]:
        receipt["id"] = None

    body = {
        "inactiveId": invoiceData["id"],
        "branchNo": invoiceData["branchNo"],
        "totalAmount": invoiceData["totalAmount"],
        "totalVat": invoiceData["totalVAT"],
        "totalCityTax": invoiceData["totalCityTax"],
        "districtCode": invoiceData["districtCode"],
        "merchantTin": invoiceData["merchantTin"],
        "posNo": ebarimtInfo["posNo"],
        "type": invoiceData["type"],
        "billIdSuffix": f"POS-{date.today()}",
        "customerTin": None if "customerTin" not in invoiceData else invoiceData["customerTin"],
        "reportMonth": None if "reportMonth" not in invoiceData else invoiceData["reportMonth"],
        "receipts": invoiceData["receipts"],
        "payments": invoiceData["payments"],
    }

    try:
        resp = requests.post(baseUrl + "/rest/receipt", json=body)
        resp_data = resp.json()

        if(resp_data["status"] != "SUCCESS"):
            frappe.throw(f"[Ebarimt] Баримт засварлах амжилтгүй: {resp_data['message']}")
            return
        
        frappe.msgprint('[Ebarimt] Баримтыг амжилттай засварлалаа.')
        frappe.set_value("Ebarimt Receipt", invoice_doc_name, "data", json.dumps(resp_data, indent=2))
    except requests.exceptions.ConnectionError:
        frappe.msgprint('[Ebarimt] Баримтыг засварлахад алдаа гарлаа')

@frappe.whitelist()
def get_branch_codes():
    ebarimtSettings: EbarimtSettings = frappe.get_single("Ebarimt Settings")
    resp = requests.get(f"{ebarimtSettings.ebarimt_url}/api/info/check/getBranchInfo")

    if(resp.status_code != 200):
        frappe.throw('[Ebarimt] Орон нутгийн кодыг авахад алдаа гарлаа.')

    return resp.json()

@frappe.whitelist()
def getProductTaxCode():
    ebarimtSettings: EbarimtSettings = frappe.get_single("Ebarimt Settings")
    resp = requests.get(f"{ebarimtSettings.ebarimt_url}/api/receipt/receipt/getProductTaxCode")

    if(resp.status_code != 200):
        frappe.throw('[Ebarimt] Бараа үйлчилгээний код авахад алдаа гарлаа.')

    msg = resp.json()

    # Bug from ITC
    for productCode in msg["data"]:
        if(productCode["taxTypeName"] == 'NO_VAT'):
            productCode["taxTypeName"] = 'NOT_VAT'

    return msg

@frappe.whitelist()
def get_info():
    ebarimtSettings: EbarimtSettings = frappe.get_single("Ebarimt Settings")
    resp = requests.get(ebarimtSettings.base_url + "/rest/info")

    ebarimtSettings.lottery_threshold

    if(resp.status_code != 200):
        frappe.throw('[Ebarimt] getInformation алдаа гарлаа.')

    data = resp.json()
    if(data["leftLotteries"] < ebarimtSettings.lottery_threshold):
        frappe.msgprint(
            title='Ebarimt',
            msg=f'Системд {data["leftLotteries"]} сугалаа үлдсэн байна. Хэрэв сугалаа дууссан үед баримт илгээвэл сугалаагүй гарахыг анхаарна уу.',
            alert=True
        )
    return data