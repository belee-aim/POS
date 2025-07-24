import frappe

from erpnext.accounts.doctype.pos_profile.pos_profile import POSProfile
from erpnext.accounts.doctype.pos_payment_method.pos_payment_method import POSPaymentMethod

def pos_profile_before_validate(pos_profile: POSProfile, event):
    populate_online_payment_payment_methods(pos_profile)

def populate_online_payment_payment_methods(pos_profile: POSProfile):
    op_payment_methods = []
    if(pos_profile.custom_storepay_settings):
        mode_of_payment = frappe.db.get_value("Storepay Settings", pos_profile.custom_storepay_settings, "mode_of_payment")
        op_payment_methods.append(mode_of_payment)

    for op_payment_method in op_payment_methods:
        found = False
        for payment in pos_profile.payments:
            if(payment.mode_of_payment == op_payment_method):
                found = True
                break
        
        if(found):
            continue

        pos_pm: POSPaymentMethod = frappe.new_doc("POS Payment Method")
        pos_pm.allow_in_returns = 0
        pos_pm.default = 0
        pos_pm.mode_of_payment = op_payment_method
        pos_pm.parent = pos_profile.name
        pos_pm.parentfield = 'payments'
        pos_pm.parenttype = pos_profile.doctype

        pos_pm.insert()
        pos_profile.payments.append(pos_pm)