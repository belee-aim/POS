import frappe
import requests

from pos.pos.doctype.ebarimt_settings.ebarimt_settings import EbarimtSettings

@frappe.whitelist()
def ebarimt_get_merchant_info(regNo: str):
    infoUrl = frappe.db.get_single_value("Ebarimt Settings", "info_url")

    resp = requests.get(infoUrl, {'regno': regNo})
    return resp.json()