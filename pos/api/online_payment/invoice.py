import frappe
import json

from pos.pos.doctype.online_payment_invoice.online_payment_invoice import OnlinePaymentInvoice
import pos.api.online_payment.storepay as storepay

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
    
    return isPaid