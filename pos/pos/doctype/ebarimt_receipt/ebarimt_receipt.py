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

		customer_register: DF.Data | None
		data: DF.JSON | None
		merchant_register: DF.Data | None
		state: DF.Literal["\u0418\u043b\u0433\u044d\u044d\u0433\u0434\u0441\u044d\u043d", "\u0411\u0443\u0446\u0430\u0430\u0433\u0434\u0441\u0430\u043d"]
	# end: auto-generated types
	pass
