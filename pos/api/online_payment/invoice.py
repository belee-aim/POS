import frappe
import json

import frappe.realtime

from pos.pos.doctype.online_payment_invoice.online_payment_invoice import OnlinePaymentInvoice
import pos.api.online_payment.storepay as storepay

def broadcast_paid_invoice(op_inv_name):
    frappe.realtime.publish_realtime("online_payment_invoice_paid", {
        "op_inv_name": op_inv_name,
    })

@frappe.whitelist()
def check_invoice(op_inv_name):
    op_inv: OnlinePaymentInvoice = frappe.get_doc("Online Payment Invoice", op_inv_name)

    if(op_inv.status == 'Paid'):
        return True
    
    data = json.loads(op_inv.data)
    
    isPaid = False
    if(op_inv.payment_settings_type == "Storepay Settings"):
        isPaid = storepay.check_invoice(data)

    if(isPaid):
        op_inv.status = "Paid"
        op_inv.save()
        frappe.db.commit()

        broadcast_paid_invoice(op_inv_name)
    
    return isPaid

@frappe.whitelist(allow_guest=True, methods=['GET'])
def callback(op_inv_name, invoice_secret):
    op_inv: OnlinePaymentInvoice = frappe.get_doc("Online Payment Invoice", op_inv_name)

    if(invoice_secret == op_inv.secret):
        op_inv.status = "Paid"
        op_inv.save()
        frappe.db.commit()
        broadcast_paid_invoice(op_inv_name)