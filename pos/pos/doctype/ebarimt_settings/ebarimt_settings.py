# Copyright (c) 2025, AIM and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class EbarimtSettings(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		base_url: DF.Data
		default_classification_code: DF.Data | None
		ebarimt_url: DF.Data
		lottery_threshold: DF.Int
		nhat_account: DF.Link | None
		noat_account: DF.Link
	# end: auto-generated types
	pass
