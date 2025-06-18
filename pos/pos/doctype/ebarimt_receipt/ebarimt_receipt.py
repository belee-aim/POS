# Copyright (c) 2025, AIM and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class EbarimtReceipt(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		items: DF.JSON | None
		merchant_info: DF.Link
		payments: DF.JSON | None
		total_amount: DF.Float
		type: DF.Literal["B2C_RECEIPT", "B2B_RECEIPT", "B2C_INVOICE", "B2B_INVOICE"]
	# end: auto-generated types
	pass
