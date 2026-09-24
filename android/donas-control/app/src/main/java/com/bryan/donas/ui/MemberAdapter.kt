package com.bryan.donas.ui

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.core.view.isVisible
import androidx.core.widget.doAfterTextChanged
import androidx.recyclerview.widget.RecyclerView
import com.bryan.donas.R
import com.bryan.donas.databinding.ItemMemberBinding
import com.bryan.donas.domain.ShareMode

class MemberAdapter(private val model: MainViewModel, private val changed: () -> Unit) : RecyclerView.Adapter<MemberAdapter.Holder>() {
    init { setHasStableIds(true) }
    override fun getItemId(position: Int) = model.members[position].id
    override fun getItemCount() = model.members.size
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) = Holder(ItemMemberBinding.inflate(LayoutInflater.from(parent.context), parent, false))
    override fun onBindViewHolder(holder: Holder, position: Int) { holder.bind(model.members[position]) }

    inner class Holder(private val binding: ItemMemberBinding) : RecyclerView.ViewHolder(binding.root) {
        private var member: MemberDraft? = null
        private var bindingNow = false
        init {
            // RecyclerView owns editor state through the draft; prevent duplicate view IDs from restoring wrong rows.
            binding.name.isSaveEnabled = false
            binding.value.isSaveEnabled = false
            binding.remainder.isSaveEnabled = false
            binding.name.doAfterTextChanged { if (!bindingNow) { member?.name = it.toString(); changed() } }
            binding.value.doAfterTextChanged {
                if (!bindingNow) {
                    if (model.mode == ShareMode.PERCENTAGE) member?.percent = it.toString() else member?.fixed = it.toString()
                    changed()
                }
            }
            binding.remainder.setOnClickListener {
                val chosen = member ?: return@setOnClickListener
                val old = model.members.indexOfFirst { it.remainder }
                model.members.forEach { it.remainder = it.id == chosen.id }
                if (old >= 0) notifyItemChanged(old)
                notifyItemChanged(bindingAdapterPosition)
                changed()
            }
            binding.remove.setOnClickListener {
                val position = bindingAdapterPosition
                if (position == RecyclerView.NO_POSITION || model.members.size <= 1) return@setOnClickListener
                val wasRemainder = model.members.removeAt(position).remainder
                notifyItemRemoved(position)
                if (wasRemainder) { model.members.first().remainder = true; notifyItemChanged(0) }
                if (model.members.size == 1) notifyItemChanged(0)
                changed()
            }
        }
        fun bind(draft: MemberDraft) {
            bindingNow = true
            member = draft
            val isFixed = model.mode == ShareMode.FIXED
            binding.name.setText(draft.name)
            binding.valueLayout.hint = binding.root.context.getString(if (isFixed) R.string.fixed_hint else R.string.percentage_hint)
            binding.value.setText(if (isFixed) draft.fixed else draft.percent)
            binding.valueLayout.isVisible = !(isFixed && draft.remainder)
            binding.remainder.isVisible = isFixed
            binding.remainder.isChecked = draft.remainder
            binding.remove.isEnabled = model.members.size > 1
            bindingNow = false
        }
    }
}
