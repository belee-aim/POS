# Copyright (c) 2025, AIM and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class EbarimtMerchantInfo(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		branch_no: DF.Data
		merchant_tin: DF.Data
		pos_no: DF.Data
	# end: auto-generated types
	pass
