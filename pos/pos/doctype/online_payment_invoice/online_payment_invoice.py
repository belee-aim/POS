# Copyright (c) 2025, AIM and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class OnlinePaymentInvoice(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		amount: DF.Float
		data: DF.JSON | None
		naming_series: DF.Data | None
		payment_settings: DF.DynamicLink | None
		payment_settings_type: DF.Link | None
		status: DF.Literal["Paid", "Unpaid"]
	# end: auto-generated types
	pass
