"""
llm_reasoning.py
Module for integrating LLM (Groq/Gemini) reasoning into the ATC bot pipeline.
Handles ambiguous/complex scenarios by querying an LLM and extracting actionable ATC commands.
"""

import os
from dotenv import load_dotenv
from groq import Groq

class LLMReasoner:
    def __init__(self, api_key=None):
        load_dotenv()
        self.api_key = api_key or os.getenv('GROQ_API_KEY_1') or os.getenv('GROQ_API_KEY')
        self.client = Groq(api_key=self.api_key)

    def query_llm(self, prompt, model='llama-3.3-70b-versatile'):
        messages = [
            {"role": "system", "content": "You are an expert ATC assistant. Output only actionable ATC instructions."},
            {"role": "user", "content": prompt},
        ]
        chat_completion = self.client.chat.completions.create(
            messages=messages,
            model=model,
        )
        return chat_completion.choices[0].message.content.strip()

    def get_atc_instruction(self, event_context):
        """
        Given an event context (dict or str), query the LLM for the correct ATC instruction.
        """
        if isinstance(event_context, dict):
            prompt = f"Event: {event_context.get('event_type')}\nDetails: {event_context}"
        else:
            prompt = str(event_context)
        return self.query_llm(prompt)

# Example usage:
# llm = LLMReasoner(api_key='YOUR_API_KEY')
# instruction = llm.get_atc_instruction({'event_type': 'ambiguous_landing', 'callsign': 'UAL123', ...})
