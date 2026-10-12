import {createContext} from 'react';
import type {ModuleLiveFeedItem} from '@/hooks/useModuleLiveFeed';
export const EconomicDeliveryContext=createContext<{items:ModuleLiveFeedItem[];applied:(keys:string[])=>void}>({items:[],applied:()=>{}});
