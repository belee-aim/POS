# Copyright (c) 2025, AIM and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class StorepaySettings(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		mode_of_payment: DF.Link
		store_id: DF.Data
	# end: auto-generated types
	pass
